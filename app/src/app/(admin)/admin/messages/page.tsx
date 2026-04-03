"use client";

import { useState, useEffect, useCallback } from "react";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  ai_prompt_hint: string | null;
  trigger_event: string | null;
  is_system: boolean;
}

interface Client {
  id: string;
  profile_id: string;
  display_name: string;
  email: string | null;
  status: string;
}

interface SentMessage {
  id: string;
  client_id: string;
  subject: string;
  body: string;
  sent_at: string;
  trigger_event: string | null;
}

type View = "hub" | "compose" | "sent" | "templates";

export default function AdminMessagesPage() {
  const [view, setView] = useState<View>("hub");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [tRes, cRes, sRes] = await Promise.all([
      fetch("/api/admin/messages/templates"),
      fetch("/api/admin/profiles"),
      fetch("/api/admin/messages"),
    ]);
    if (tRes.ok) setTemplates(await tRes.json());
    if (cRes.ok) setClients(await cRes.json());
    if (sRes.ok) setSentMessages(await sRes.json());
    setLoading(false);
  }

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function handlePickTemplate(template: Template) {
    setSelectedTemplate(template);

    if (!selectedClient) {
      setSubject(template.subject);
      setBody(template.body);
      return;
    }

    // Get AI-assisted draft with merge fields resolved
    setDrafting(true);
    const res = await fetch("/api/admin/messages/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: selectedClient.id,
        template_id: template.id,
      }),
    });

    if (res.ok) {
      const draft = await res.json();
      setSubject(draft.subject);
      setBody(draft.body);
    } else {
      setSubject(template.subject);
      setBody(template.body);
    }
    setDrafting(false);
  }

  async function handleGenerateAI() {
    if (!selectedClient) return;
    setDrafting(true);

    const res = await fetch("/api/admin/messages/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: selectedClient.id,
        template_id: selectedTemplate?.id,
        context: "Write a personalized check-in email based on their current pipeline status and activity.",
      }),
    });

    if (res.ok) {
      const draft = await res.json();
      if (draft.body) setBody(draft.body);
      if (draft.subject && !subject) setSubject(draft.subject);
    }
    setDrafting(false);
  }

  async function handleSend() {
    if (!selectedClient || !subject || !body) return;
    setSending(true);

    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: selectedClient.id,
        template_id: selectedTemplate?.id,
        subject,
        body,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.sent) {
        showToast("Email sent successfully!");
      } else if (result.saved) {
        showToast(result.error ? `Saved but not sent: ${result.error}` : "Message saved (email not configured)");
      } else {
        showToast("Failed to send");
      }
      setSelectedClient(null);
      setSelectedTemplate(null);
      setSubject("");
      setBody("");
      setView("hub");
      const sRes = await fetch("/api/admin/messages");
      if (sRes.ok) setSentMessages(await sRes.json());
    } else {
      const err = await res.json();
      showToast(err.error || "Failed to send email");
    }
    setSending(false);
  }

  function resetCompose() {
    setSelectedClient(null);
    setSelectedTemplate(null);
    setSubject("");
    setBody("");
    setView("hub");
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#171F28]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#6AD7A3] px-4 py-2 text-sm font-medium text-[#0C1016]">
          {toast}
        </div>
      )}

      {/* Hub Home */}
      {view === "hub" && (
        <>
          <h1 className="text-lg font-semibold">Message Hub</h1>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setView("compose")}
              className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-5 text-left transition hover:bg-[#222D3D]"
            >
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#6AD7A3]/10">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#6AD7A3]" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <span className="text-sm font-semibold">Compose</span>
              <p className="mt-1 text-[11px] text-[#9CA3AF]">Send a message to a client</p>
            </button>

            <button
              onClick={() => setView("sent")}
              className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-5 text-left transition hover:bg-[#222D3D]"
            >
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#38BDF8]/10">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#38BDF8]" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <span className="text-sm font-semibold">Sent</span>
              <p className="mt-1 text-[11px] text-[#9CA3AF]">{sentMessages.length} messages sent</p>
            </button>
          </div>

          {/* Templates preview */}
          <div className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Templates</h2>
              <button
                onClick={() => setView("templates")}
                className="text-[11px] text-[#6AD7A3]"
              >
                View All
              </button>
            </div>
            <div className="space-y-2">
              {templates.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg bg-[#151C24] px-3 py-2"
                >
                  <span className="text-[13px] text-white">{t.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                    t.trigger_event
                      ? "bg-[#FAD76A]/10 text-[#FAD76A]"
                      : "bg-[#6AD7A3]/10 text-[#6AD7A3]"
                  }`}>
                    {t.trigger_event || "Manual"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Compose Flow */}
      {view === "compose" && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={resetCompose} className="text-[#9CA3AF] hover:text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold">Compose</h1>
          </div>

          {/* Step 1: Pick client */}
          {!selectedClient && (
            <div className="space-y-2">
              <label className="text-xs text-[#9CA3AF]">Select Client</label>
              {clients
                .filter((c) => c.status === "active" && c.email)
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClient(c)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-3 text-left transition hover:bg-[#222D3D]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6AD7A3]/10 text-sm font-semibold text-[#6AD7A3]">
                      {c.display_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{c.display_name}</div>
                      <div className="text-[11px] text-[#9CA3AF]">{c.email}</div>
                    </div>
                  </button>
                ))}
            </div>
          )}

          {/* Step 2: Pick template or write */}
          {selectedClient && !subject && !selectedTemplate && (
            <div className="space-y-2">
              <div className="rounded-xl bg-[#151C24] px-3 py-2 text-sm">
                To: <span className="font-medium text-[#6AD7A3]">{selectedClient.display_name}</span>
                <span className="ml-2 text-[11px] text-[#9CA3AF]">{selectedClient.email}</span>
              </div>

              <label className="text-xs text-[#9CA3AF]">Choose a template or start blank</label>

              <button
                onClick={() => {
                  setSubject("");
                  setBody("");
                  setSelectedTemplate({ id: "blank", name: "Blank", subject: "", body: "", ai_prompt_hint: null, trigger_event: null, is_system: false });
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[rgba(255,255,255,0.2)] bg-[#171F28] p-3 text-left transition hover:bg-[#222D3D]"
              >
                <span className="text-sm text-[#B8BFC8]">Start blank</span>
              </button>

              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handlePickTemplate(t)}
                  className="flex w-full items-center justify-between rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-3 text-left transition hover:bg-[#222D3D]"
                >
                  <div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-[11px] text-[#9CA3AF]">{t.subject.slice(0, 60)}</div>
                  </div>
                  {t.ai_prompt_hint && (
                    <span className="rounded-full bg-[#8B5CF6]/10 px-2 py-0.5 text-[10px] text-[#8B5CF6]">AI</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Edit & send */}
          {selectedClient && (subject !== "" || selectedTemplate) && (
            <div className="space-y-3">
              <div className="rounded-xl bg-[#151C24] px-3 py-2 text-sm">
                To: <span className="font-medium text-[#6AD7A3]">{selectedClient.display_name}</span>
              </div>

              {drafting && (
                <div className="rounded-xl bg-[#171F28] p-4 text-center text-sm text-[#B8BFC8]">
                  <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-[#6AD7A3] border-t-transparent" />
                  Generating draft...
                </div>
              )}

              {!drafting && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-[#9CA3AF]">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
                      placeholder="Email subject..."
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-[#9CA3AF]">Body</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={10}
                      className="w-full rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
                      placeholder="Write your message..."
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateAI}
                      disabled={drafting}
                      className="rounded-full border border-[#6AD7A3] px-4 py-2 text-sm text-[#6AD7A3] transition hover:bg-[#6AD7A3]/10"
                    >
                      Generate AI Content
                    </button>

                    <button
                      onClick={handleSend}
                      disabled={sending || !subject || !body}
                      className="ml-auto rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-6 py-2 text-sm font-semibold text-[#0C1016] transition disabled:opacity-40"
                    >
                      {sending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Sent Messages */}
      {view === "sent" && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => setView("hub")} className="text-[#9CA3AF] hover:text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold">Sent Messages</h1>
          </div>

          {/* Stats */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl bg-[#171F28] p-3 text-center">
              <p className="text-lg font-bold text-[#6AD7A3]">{sentMessages.length}</p>
              <p className="text-[10px] text-[#6B7280]">Total Sent</p>
            </div>
            <div className="flex-1 rounded-xl bg-[#171F28] p-3 text-center">
              <p className="text-lg font-bold text-[#38BDF8]">
                {new Set(sentMessages.map((m) => m.client_id)).size}
              </p>
              <p className="text-[10px] text-[#6B7280]">Clients Reached</p>
            </div>
            <div className="flex-1 rounded-xl bg-[#171F28] p-3 text-center">
              <p className="text-lg font-bold text-[#FAD76A]">
                {sentMessages.filter((m) => {
                  const d = new Date(m.sent_at);
                  const week = new Date(Date.now() - 7 * 86400000);
                  return d > week;
                }).length}
              </p>
              <p className="text-[10px] text-[#6B7280]">This Week</p>
            </div>
          </div>

          {sentMessages.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl bg-[#171F28] p-12 text-center">
              <svg viewBox="0 0 24 24" className="mb-3 h-10 w-10 text-[#2A3544]" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <p className="text-sm font-medium text-[#B8BFC8]">No messages sent yet</p>
              <p className="mt-1 text-[11px] text-[#6B7280]">Compose a message to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sentMessages.map((msg) => {
                const client = clients.find((c) => c.id === msg.client_id);
                const sentDate = new Date(msg.sent_at);
                const timeAgo = formatTimeAgo(sentDate);
                return (
                  <div
                    key={msg.id}
                    className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6AD7A3]/10 text-xs font-bold text-[#6AD7A3]">
                          {(client?.display_name ?? "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{client?.display_name ?? "Unknown"}</p>
                          <p className="text-[11px] text-[#6B7280]">{client?.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-[#9CA3AF]">{timeAgo}</p>
                        <p className="text-[10px] text-[#4B5563]">
                          {sentDate.toLocaleDateString()} {sentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 text-[13px] font-medium text-white">{msg.subject}</div>
                    <p className="mt-1 text-[12px] text-[#9CA3AF] line-clamp-2">{msg.body.slice(0, 150)}...</p>
                    <div className="mt-2 flex gap-1.5">
                      {msg.trigger_event && (
                        <span className="rounded-full bg-[#FAD76A]/10 px-2 py-0.5 text-[10px] font-medium text-[#FAD76A]">
                          {msg.trigger_event}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Templates View */}
      {view === "templates" && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => setView("hub")} className="text-[#9CA3AF] hover:text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold">Templates</h1>
          </div>

          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#171F28] p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{t.name}</span>
                  <div className="flex gap-1">
                    {t.is_system && (
                      <span className="rounded-full bg-[#38BDF8]/10 px-2 py-0.5 text-[10px] text-[#38BDF8]">System</span>
                    )}
                    {t.trigger_event && (
                      <span className="rounded-full bg-[#FAD76A]/10 px-2 py-0.5 text-[10px] text-[#FAD76A]">{t.trigger_event}</span>
                    )}
                    {t.ai_prompt_hint && (
                      <span className="rounded-full bg-[#8B5CF6]/10 px-2 py-0.5 text-[10px] text-[#8B5CF6]">AI</span>
                    )}
                  </div>
                </div>
                <div className="mt-1 text-[12px] text-[#9CA3AF]">{t.subject}</div>
                <div className="mt-2 text-[12px] text-[#B8BFC8] line-clamp-3">{t.body.slice(0, 200)}...</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
