"use client";

import { useState, useEffect } from "react";
import { useViewAs } from "@/components/view-as/view-as-context";
import { useRouter } from "next/navigation";

interface ThreadMessage {
  id: string;
  direction: "sent" | "received";
  subject: string | null;
  body: string;
  timestamp: string;
  gmail_thread_id: string | null;
}

export default function ViewAsMessagesPage() {
  const { active, clientId, clientName } = useViewAs();
  const router = useRouter();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!active || !clientId) {
      router.replace("/admin");
      return;
    }
    loadMessages();
  }, [active, clientId]);

  async function loadMessages() {
    setLoading(true);
    const res = await fetch(`/api/admin/messages/conversations/${clientId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
    }
    setLoading(false);
  }

  function groupByThread(msgs: ThreadMessage[]) {
    const groups = new Map<string, ThreadMessage[]>();
    for (const msg of msgs) {
      const baseSubject = (msg.subject || "(no subject)")
        .replace(/^(Re:\s*)+/i, "")
        .trim() || "(no subject)";
      const existing = groups.get(baseSubject) ?? [];
      existing.push(msg);
      groups.set(baseSubject, existing);
    }
    for (const threadMsgs of groups.values()) {
      threadMsgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    const sorted = [...groups.entries()].sort((a, b) => {
      return new Date(b[1][0].timestamp).getTime() - new Date(a[1][0].timestamp).getTime();
    });
    return sorted;
  }

  function stripQuotedText(body: string): string {
    const lines = body.split("\n");
    const cleaned: string[] = [];
    for (const line of lines) {
      if (/^On .+ wrote:$/i.test(line.trim())) break;
      if (/^>/.test(line.trim())) break;
      if (/^-{3,}/.test(line.trim()) && cleaned.length > 0) break;
      if (/^_{3,}/.test(line.trim()) && cleaned.length > 0) break;
      cleaned.push(line);
    }
    while (cleaned.length > 0 && cleaned[cleaned.length - 1].trim() === "") {
      cleaned.pop();
    }
    return cleaned.join("\n") || body;
  }

  function formatTimeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  }

  function toggleThread(subject: string) {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  }

  // Auto-expand all threads on first load
  const threadGroups = groupByThread(messages);
  if (expandedThreads.size === 0 && threadGroups.length > 0 && !loading) {
    const allSubjects = new Set(threadGroups.map(([subject]) => subject));
    if (allSubjects.size > 0) setExpandedThreads(allSubjects);
  }

  const sentCount = messages.filter((m) => m.direction === "sent").length;
  const receivedCount = messages.filter((m) => m.direction === "received").length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Messages
          </h2>
          <p className="text-[11px] text-[#6B7280] mt-0.5">
            {clientName ? `Communication history for ${clientName}` : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#6B7280]" />
            <span className="text-[#9CA3AF]">Sent <span className="font-semibold text-white">{sentCount}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "linear-gradient(180deg, #A9FFB5, #39D6FF)" }} />
            <span className="text-[#9CA3AF]">Received <span className="font-semibold text-white">{receivedCount}</span></span>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#171F28]" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-[#171F28] p-12 text-center">
          <svg viewBox="0 0 24 24" className="mb-3 h-10 w-10 text-[#2A3544]" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-sm font-medium text-[#B8BFC8]">No messages yet</p>
          <p className="mt-1 text-[11px] text-[#6B7280]">No communications have been sent to this client</p>
        </div>
      ) : (
        <div className="space-y-4">
          {threadGroups.map(([subject, msgs]) => {
            const isExpanded = expandedThreads.has(subject);
            const hasReply = msgs.some((m) => m.direction === "received");
            const newestMsg = msgs[0];

            return (
              <div key={subject} className="rounded-2xl border border-[#2A3544]/60 bg-[#0C1016] overflow-hidden">
                {/* Thread header */}
                <button
                  onClick={() => toggleThread(subject)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#151C24]"
                >
                  <div
                    className="h-6 w-1 rounded-full shrink-0"
                    style={{ background: "linear-gradient(180deg, #FAD76A, #FAD76A80)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-white truncate">{subject}</span>
                      {hasReply && (
                        <span className="shrink-0 rounded-full bg-[#6AD7A3]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#6AD7A3]">
                          REPLY
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#6B7280]">
                      {msgs.length} message{msgs.length !== 1 ? "s" : ""} &middot; {formatTimeAgo(new Date(newestMsg.timestamp))}
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-4 w-4 text-[#6B7280] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {/* Messages */}
                {isExpanded && (
                  <div className="border-t border-[#2A3544]/40 bg-[#111820] rounded-b-2xl px-3 pb-3 pt-2 space-y-2">
                    {msgs.map((msg) => {
                      const isSent = msg.direction === "sent";
                      const displayBody = isSent ? msg.body : stripQuotedText(msg.body);

                      return (
                        <div
                          key={msg.id}
                          className={`rounded-xl p-3 ${
                            isSent
                              ? "bg-[#171F28] border border-[rgba(255,255,255,0.06)]"
                              : "bg-[#171F28] border-l-[3px] border-l-[#6AD7A3]"
                          }`}
                        >
                          <div className="mb-1.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isSent ? (
                                <span className="text-[10px] font-medium uppercase tracking-wider text-[#6B7280]">Coach</span>
                              ) : (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6AD7A3]">
                                  {clientName}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#4B5563]">
                              {formatTimeAgo(new Date(msg.timestamp))}
                            </span>
                          </div>
                          <p className={`whitespace-pre-wrap text-[13px] leading-relaxed ${
                            isSent ? "text-[#B8BFC8]" : "text-white"
                          }`}>
                            {displayBody}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
