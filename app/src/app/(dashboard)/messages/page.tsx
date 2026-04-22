"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MessageSquare } from "lucide-react";
import { useViewAs } from "@/components/view-as/view-as-context";
import { Badge, Card, EmptyState, Section } from "@/components/design-system";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const baseSubject =
        (msg.subject || "(no subject)").replace(/^(Re:\s*)+/i, "").trim() || "(no subject)";
      const existing = groups.get(baseSubject) ?? [];
      existing.push(msg);
      groups.set(baseSubject, existing);
    }
    for (const threadMsgs of groups.values()) {
      threadMsgs.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    }
    const sorted = [...groups.entries()].sort(
      (a, b) => new Date(b[1][0].timestamp).getTime() - new Date(a[1][0].timestamp).getTime(),
    );
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

  const threadGroups = groupByThread(messages);
  if (expandedThreads.size === 0 && threadGroups.length > 0 && !loading) {
    const allSubjects = new Set(threadGroups.map(([subject]) => subject));
    if (allSubjects.size > 0) setExpandedThreads(allSubjects);
  }

  const sentCount = messages.filter((m) => m.direction === "sent").length;
  const receivedCount = messages.filter((m) => m.direction === "received").length;

  return (
    <div className="p-4 md:p-6 font-[family-name:var(--font-ds-sans)] text-[var(--ds-text-1)]">
      <Section
        eyebrow="Messages"
        title="Communication history"
        description={clientName ? `Thread view for ${clientName}.` : "Loading…"}
        actions={
          <div className="hidden sm:flex items-center gap-2">
            <Badge tone="neutral">Sent {sentCount}</Badge>
            <Badge tone="accent" dot>
              Received {receivedCount}
            </Badge>
          </div>
        }
      >
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-ds-shimmer rounded-[var(--ds-radius-lg)]" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <Card>
            <EmptyState
              icon={<MessageSquare size={20} strokeWidth={1.75} />}
              title="No messages yet"
              description="No communications have been sent to this client."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {threadGroups.map(([subject, msgs]) => {
              const isExpanded = expandedThreads.has(subject);
              const hasReply = msgs.some((m) => m.direction === "received");
              const newestMsg = msgs[0];

              return (
                <Card key={subject} className="overflow-hidden">
                  <button
                    onClick={() => toggleThread(subject)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--ds-bg-2)]"
                  >
                    <div
                      className="h-5 w-[3px] rounded-full shrink-0 bg-[var(--ds-signal)]"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-[var(--ds-text-0)] truncate">
                          {subject}
                        </span>
                        {hasReply ? (
                          <Badge tone="accent" dot>
                            Reply
                          </Badge>
                        ) : null}
                      </div>
                      <span className="font-[family-name:var(--font-ds-mono)] text-[11px] text-[var(--ds-text-3)]">
                        {msgs.length} message{msgs.length !== 1 ? "s" : ""} ·{" "}
                        {formatTimeAgo(new Date(newestMsg.timestamp))}
                      </span>
                    </div>
                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      className={[
                        "text-[var(--ds-text-3)] transition-transform",
                        isExpanded ? "rotate-180" : "",
                      ].join(" ")}
                    />
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-[var(--ds-border-1)] bg-[var(--ds-bg-0)] px-3 pb-3 pt-2 space-y-2">
                      {msgs.map((msg) => {
                        const isSent = msg.direction === "sent";
                        const displayBody = isSent ? msg.body : stripQuotedText(msg.body);
                        return (
                          <div
                            key={msg.id}
                            className="rounded-[var(--ds-radius-md)] bg-[var(--ds-bg-1)] border border-[var(--ds-border-1)] p-3"
                            style={
                              isSent
                                ? undefined
                                : { borderLeft: "2px solid var(--ds-accent)" }
                            }
                          >
                            <div className="mb-1.5 flex items-center justify-between">
                              <span
                                className={[
                                  "font-[family-name:var(--font-ds-mono)] text-[10px] font-semibold uppercase tracking-[0.1em]",
                                  isSent ? "text-[var(--ds-text-3)]" : "text-[var(--ds-accent-bright)]",
                                ].join(" ")}
                              >
                                {isSent ? "Coach" : clientName}
                              </span>
                              <span className="font-[family-name:var(--font-ds-mono)] text-[10px] text-[var(--ds-text-3)]">
                                {formatTimeAgo(new Date(msg.timestamp))}
                              </span>
                            </div>
                            <p
                              className={[
                                "whitespace-pre-wrap text-[13px] leading-relaxed",
                                isSent ? "text-[var(--ds-text-1)]" : "text-[var(--ds-text-0)]",
                              ].join(" ")}
                            >
                              {displayBody}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
