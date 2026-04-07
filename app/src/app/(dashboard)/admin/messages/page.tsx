"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Zap, Send, Eye, X, Pencil } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

interface Suggestion {
  id: string;
  client_id: string;
  trigger_event: string;
  template_id: string | null;
  tracker_entry_id: string | null;
  status: string;
  context_snapshot: Record<string, unknown>;
  created_at: string;
  client: { id: string; display_name: string; email: string | null } | null;
  template: { id: string; name: string; subject: string; trigger_event: string | null } | null;
  tracker_entry: { id: string; company: string; title: string; status: string } | null;
}

interface Conversation {
  client_id: string | null;
  email: string;
  display_name: string | null;
  last_message_preview: string;
  last_message_at: string;
  last_direction: "sent" | "received";
  unread_count: number;
}

interface ThreadMessage {
  id: string;
  direction: "sent" | "received";
  subject: string | null;
  body: string;
  timestamp: string;
  gmail_thread_id: string | null;
  message_id: string | null;
}

type View = "outreach" | "compose" | "conversations";

/* ------------------------------------------------------------------ */
/*  Merge field tokens                                                 */
/* ------------------------------------------------------------------ */

const MERGE_FIELDS = [
  "{clientName}",
  "{clientEmail}",
  "{coachName}",
  "{pipelineCount}",
  "{appliedCount}",
  "{interviewCount}",
  "{daysSinceLastFetch}",
  "{topSkills}",
  "{assignedLanes}",
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminMessagesPage() {
  const [view, setView] = useState<View>("outreach");
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadSharedData();
  }, []);

  async function loadSharedData() {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([
        fetch("/api/admin/messages/templates"),
        fetch("/api/admin/profiles"),
      ]);
      if (tRes.ok) setTemplates(await tRes.json());
      if (cRes.ok) setClients(await cRes.json());
    } catch {
      showToast("Failed to load data");
    }
    setLoading(false);
  }

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#171F28]" />
        ))}
      </div>
    );
  }

  const views: { key: View; label: string }[] = [
    { key: "outreach", label: "Outreach" },
    { key: "compose", label: "Compose" },
    { key: "conversations", label: "Conversations" },
  ];

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#6AD7A3] px-4 py-2 text-sm font-medium text-[#0C1016]">
          {toast}
        </div>
      )}

      {/* View tab bar */}
      <div className="flex gap-1 rounded-xl bg-[#151C24] p-1">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              view === v.key
                ? "bg-[#171F28] text-[#FAD76A]"
                : "text-[#9CA3AF] hover:text-white"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "outreach" && (
        <OutreachView
          clients={clients}
          templates={templates}
          showToast={showToast}
          onComposeWith={(clientId, templateId) => {
            setView("compose");
          }}
        />
      )}
      {view === "compose" && (
        <ComposeView
          clients={clients}
          templates={templates}
          showToast={showToast}
        />
      )}
      {view === "conversations" && (
        <ConversationsView
          clients={clients}
          showToast={showToast}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  OUTREACH VIEW                                                      */
/* ================================================================== */

function OutreachView({
  clients,
  templates,
  showToast,
}: {
  clients: Client[];
  templates: Template[];
  showToast: (msg: string) => void;
  onComposeWith: (clientId: string, templateId: string | null) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sendingAll, setSendingAll] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Inline compose state for "Edit & Send"
  const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editDrafting, setEditDrafting] = useState(false);
  const [editSending, setEditSending] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, []);

  async function loadSuggestions() {
    setLoading(true);
    const res = await fetch("/api/admin/messages/suggestions");
    if (res.ok) setSuggestions(await res.json());
    setLoading(false);
  }

  async function generateSuggestions() {
    setGenerating(true);
    const res = await fetch("/api/admin/messages/suggestions/generate", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      showToast(`Generated ${data.generated} suggestion${data.generated !== 1 ? "s" : ""}`);
      await loadSuggestions();
    } else {
      showToast("Failed to generate suggestions");
    }
    setGenerating(false);
  }

  async function dismissSuggestion(id: string) {
    const res = await fetch("/api/admin/messages/suggestions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "dismissed" }),
    });
    if (res.ok) {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    }
  }

  async function sendBulk(triggerEvent: string, ids: string[], templateId: string | null) {
    if (sendingAll) return;
    setSendingAll(triggerEvent);
    const recipients = suggestions
      .filter((s) => ids.includes(s.id))
      .map((s) => ({ client_id: s.client_id }));

    const res = await fetch("/api/admin/messages/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients,
        template_id: templateId,
        trigger_event: triggerEvent,
        suggestion_ids: ids,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      showToast(`Sent ${data.sent}, ${data.failed} failed`);
      setSuggestions((prev) => prev.filter((s) => !ids.includes(s.id)));
    } else {
      showToast("Bulk send failed");
    }
    setSendingAll(null);
  }

  async function openEditSend(suggestion: Suggestion) {
    setEditingSuggestion(suggestion);
    setEditDrafting(true);

    // Fetch draft with merge fields resolved
    const res = await fetch("/api/admin/messages/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: suggestion.client_id,
        template_id: suggestion.template_id,
      }),
    });

    if (res.ok) {
      const draft = await res.json();
      setEditSubject(draft.subject || "");
      setEditBody(draft.body || "");
    } else {
      setEditSubject(suggestion.template?.subject || "");
      setEditBody("");
    }
    setEditDrafting(false);
  }

  async function sendEdited() {
    if (!editingSuggestion || !editSubject || !editBody || editSending) return;
    setEditSending(true);

    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: editingSuggestion.client_id,
        template_id: editingSuggestion.template_id,
        subject: editSubject,
        body: editBody,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.sent) showToast("Email sent!");
      else showToast(result.error ? `Saved: ${result.error}` : "Saved");

      // Mark suggestion as sent
      await fetch("/api/admin/messages/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingSuggestion.id, status: "sent" }),
      });

      setSuggestions((prev) => prev.filter((s) => s.id !== editingSuggestion.id));
      setEditingSuggestion(null);
      setEditSubject("");
      setEditBody("");
    } else {
      showToast("Failed to send");
    }
    setEditSending(false);
  }

  // Group suggestions by trigger_event
  const grouped = suggestions.reduce<Record<string, Suggestion[]>>((acc, s) => {
    (acc[s.trigger_event] ??= []).push(s);
    return acc;
  }, {});

  const triggerLabels: Record<string, string> = {
    interview_reached: "Interview Reached",
    offer_reached: "Offer Received",
    inactive_checkin: "Inactive Check-in",
    welcome: "New Client Welcome",
    weekly_digest: "Weekly Digest",
  };

  const triggerColors: Record<string, string> = {
    interview_reached: "#8B5CF6",
    offer_reached: "#22C55E",
    inactive_checkin: "#FAD76A",
    welcome: "#6AD7A3",
    weekly_digest: "#38BDF8",
  };

  /* -- Edit & Send inline pane -- */
  if (editingSuggestion) {
    const client = editingSuggestion.client;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditingSuggestion(null); setEditSubject(""); setEditBody(""); }}
            className="text-[#9CA3AF] hover:text-white"
          >
            <BackArrow />
          </button>
          <h2 className="text-lg font-semibold">Edit & Send</h2>
        </div>

        <div className="rounded-xl bg-[#151C24] px-3 py-2 text-sm">
          To: <span className="font-medium text-[#6AD7A3]">{client?.display_name ?? "Unknown"}</span>
          <span className="ml-2 text-[11px] text-[#9CA3AF]">{client?.email}</span>
        </div>

        {editDrafting ? (
          <div className="rounded-xl bg-[#171F28] p-4 text-center text-sm text-[#B8BFC8]">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-[#6AD7A3] border-t-transparent" />
            Generating draft...
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs text-[#9CA3AF]">Subject</label>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#9CA3AF]">Body</label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={sendEdited}
                disabled={editSending || !editSubject || !editBody}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-6 py-2 text-sm font-semibold text-[#0C1016] transition disabled:opacity-40"
              >
                <Send size={16} strokeWidth={2} />
                {editSending ? "Sending..." : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Outreach</h2>
        <button
          onClick={generateSuggestions}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-full border-l-2 border-[#C4CDD8] bg-[rgba(196,205,216,0.03)] px-4 py-1.5 text-sm font-semibold text-white ring-1 ring-[#C4CDD8]/10 transition hover:bg-[rgba(196,205,216,0.06)] hover:ring-[#C4CDD8]/20 disabled:opacity-40"
        >
          <Zap size={16} strokeWidth={2} className="text-[#C4CDD8]" />
          {generating ? "Scanning..." : "Generate Suggestions"}
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#171F28]" />
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-[#171F28] p-12 text-center">
          <svg viewBox="0 0 24 24" className="mb-3 h-10 w-10 text-[#2A3544]" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <p className="text-sm font-medium text-[#B8BFC8]">No pending suggestions</p>
          <p className="mt-1 text-[11px] text-[#6B7280]">Click &quot;Generate Suggestions&quot; to scan for outreach opportunities</p>
        </div>
      ) : (
        Object.entries(grouped).map(([trigger, items]) => {
          const color = triggerColors[trigger] || "#6AD7A3";
          const label = triggerLabels[trigger] || trigger;
          const isExpanded = expanded === trigger;
          const templateId = items[0]?.template_id;

          return (
            <div key={trigger} className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-semibold">{label}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    {items.length}
                  </span>
                </div>

                {items.length > 1 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : trigger)}
                      className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.12)] px-3 py-1 text-[11px] text-[#B8BFC8] transition hover:bg-[#222D3D]"
                    >
                      <Eye size={14} strokeWidth={2} />
                      {isExpanded ? "Collapse" : "Review Individually"}
                    </button>
                    <button
                      onClick={() => sendBulk(trigger, items.map((i) => i.id), templateId)}
                      disabled={sendingAll === trigger}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium text-[#0C1016] transition"
                      style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}
                    >
                      <Send size={14} strokeWidth={2} />
                      {sendingAll === trigger ? "Sending..." : `Send All (${items.length})`}
                    </button>
                  </div>
                )}
              </div>

              {/* Individual cards - show when only 1 item or expanded */}
              {(items.length === 1 || isExpanded) && (
                <div className="border-t border-[#2A3544]/50">
                  {items.map((s) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      color={color}
                      onEditSend={() => openEditSend(s)}
                      onDismiss={() => dismissSuggestion(s.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  color,
  onEditSend,
  onDismiss,
}: {
  suggestion: Suggestion;
  color: string;
  onEditSend: () => void;
  onDismiss: () => void;
}) {
  const s = suggestion;
  const ctx = s.context_snapshot;

  let description = "";
  switch (s.trigger_event) {
    case "interview_reached":
      description = `Reached ${ctx.status || "interview"} at ${ctx.company || "a company"} - ${ctx.title || ""}`;
      break;
    case "offer_reached":
      description = `Received an offer from ${ctx.company || "a company"}`;
      break;
    case "inactive_checkin":
      description = `Inactive for ${ctx.days_inactive === "never" ? "unknown" : `${ctx.days_inactive} days`}`;
      break;
    case "welcome":
      description = "Just onboarded";
      break;
    case "weekly_digest":
      description = "Weekly digest due";
      break;
    default:
      description = s.trigger_event;
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 transition hover:bg-[#1A2330]">
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {s.client?.display_name ? s.client.display_name[0].toUpperCase() : "-"}
        </div>
        <div>
          <p className="text-sm font-medium">{s.client?.display_name ?? <span className="rounded-full bg-[#9CA3AF]/10 px-2 py-0.5 text-[11px] text-[#9CA3AF] ring-1 ring-[#9CA3AF]/20">Removed User</span>}</p>
          <p className="text-[11px] text-[#9CA3AF]">{description}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onDismiss}
          className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.12)] px-3 py-1 text-[11px] text-[#9CA3AF] transition hover:bg-[#222D3D] hover:text-white"
        >
          <X size={14} strokeWidth={2} />
          Dismiss
        </button>
        <button
          onClick={onEditSend}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium text-[#0C1016]"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}
        >
          <Pencil size={14} strokeWidth={2} />
          Edit & Send
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  COMPOSE VIEW                                                       */
/* ================================================================== */

function ComposeView({
  clients,
  templates,
  showToast,
}: {
  clients: Client[];
  templates: Template[];
  showToast: (msg: string) => void;
}) {
  const [step, setStep] = useState<"recipients" | "template" | "editor">("recipients");
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [freeEmails, setFreeEmails] = useState<string[]>([]);
  const [freeEmailInput, setFreeEmailInput] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [search, setSearch] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const activeClients = clients.filter((c) => c.status === "active" && c.email);
  const filteredClients = search
    ? activeClients.filter(
        (c) =>
          c.display_name.toLowerCase().includes(search.toLowerCase()) ||
          (c.email && c.email.toLowerCase().includes(search.toLowerCase())),
      )
    : activeClients;

  function toggleClient(client: Client) {
    setSelectedClients((prev) =>
      prev.some((c) => c.id === client.id)
        ? prev.filter((c) => c.id !== client.id)
        : [...prev, client],
    );
  }

  async function handlePickTemplate(template: Template) {
    setSelectedTemplate(template);
    setStep("editor");

    if (selectedClients.length === 1) {
      setDrafting(true);
      const res = await fetch("/api/admin/messages/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClients[0].id,
          template_id: template.id,
        }),
      });
      if (res.ok) {
        const draft = await res.json();
        setSubject(draft.subject || "");
        setBody(draft.body || "");
      } else {
        setSubject(template.subject);
        setBody(template.body);
      }
      setDrafting(false);
    } else {
      // For bulk, show template with raw merge fields
      setSubject(template.subject);
      setBody(template.body);
    }
  }

  function handleStartBlank() {
    setSelectedTemplate(null);
    setSubject("");
    setBody("");
    setStep("editor");
  }

  function insertMergeField(field: string) {
    const textarea = bodyRef.current;
    if (!textarea) {
      setBody((prev) => prev + field);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = body.slice(0, start) + field + body.slice(end);
    setBody(newBody);
    // Restore cursor position after the inserted field
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + field.length, start + field.length);
    }, 0);
  }

  async function handleRefineWithAI() {
    if (selectedClients.length !== 1 || !body) return;
    setDrafting(true);

    const res = await fetch("/api/admin/messages/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: selectedClients[0].id,
        refine_body: body,
      }),
    });

    if (res.ok) {
      const draft = await res.json();
      if (draft.body) setBody(draft.body);
    }
    setDrafting(false);
  }

  const totalRecipients = selectedClients.length + freeEmails.length;

  async function handleSend() {
    if (!subject || !body || totalRecipients === 0 || sending) return;
    setSending(true);

    let sentCount = 0;
    let failedCount = 0;

    // Send to selected client profiles
    if (selectedClients.length === 1 && freeEmails.length === 0) {
      // Single client send
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClients[0].id,
          template_id: selectedTemplate?.id,
          subject,
          body,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.sent) sentCount++; else failedCount++;
      } else {
        failedCount++;
      }
    } else if (selectedClients.length > 0) {
      // Bulk client send
      const res = await fetch("/api/admin/messages/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: selectedClients.map((c) => ({ client_id: c.id })),
          template_id: selectedTemplate?.id || templates[0]?.id,
          trigger_event: "manual_bulk",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        sentCount += data.sent;
        failedCount += data.failed;
      } else {
        failedCount += selectedClients.length;
      }
    }

    // Send to free email addresses
    for (const email of freeEmails) {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_email: email, subject, body }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.sent) sentCount++; else failedCount++;
      } else {
        failedCount++;
      }
    }

    if (failedCount === 0) {
      showToast(sentCount === 1 ? "Email sent!" : `${sentCount} emails sent!`);
    } else {
      showToast(`Sent ${sentCount}, ${failedCount} failed`);
    }
    resetCompose();
    setSending(false);
  }

  function resetCompose() {
    setStep("recipients");
    setSelectedClients([]);
    setSelectedTemplate(null);
    setSubject("");
    setBody("");
    setFreeEmails([]);
    setFreeEmailInput("");
    setSearch("");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {step !== "recipients" && (
          <button
            onClick={() => {
              if (step === "editor") setStep("template");
              else setStep("recipients");
            }}
            className="text-[#9CA3AF] hover:text-white"
          >
            <BackArrow />
          </button>
        )}
        <h2 className="text-lg font-semibold">Compose</h2>
        <div className="ml-auto flex gap-1.5">
          {["recipients", "template", "editor"].map((s, i) => (
            <div
              key={s}
              className={`h-1.5 w-6 rounded-full transition ${
                step === s ? "bg-[#6AD7A3]" : i < ["recipients", "template", "editor"].indexOf(step) ? "bg-[#6AD7A3]/40" : "bg-[#2A3544]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Recipients */}
      {step === "recipients" && (
        <div className="space-y-2">
          {/* Selected pills */}
          {selectedClients.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedClients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleClient(c)}
                  className="flex items-center gap-1.5 rounded-full bg-[#6AD7A3]/10 px-3 py-1 text-[12px] text-[#6AD7A3] transition hover:bg-[#6AD7A3]/20"
                >
                  {c.display_name}
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
            placeholder="Search clients..."
          />

          {/* Client list */}
          <div className="max-h-[400px] space-y-1 overflow-y-auto">
            {filteredClients.map((c) => {
              const isSelected = selectedClients.some((sc) => sc.id === c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleClient(c)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-[#6AD7A3]/30 bg-[#6AD7A3]/5"
                      : "border-[rgba(255,255,255,0.08)] bg-[#171F28] hover:bg-[#222D3D]"
                  }`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                    isSelected ? "border-[#6AD7A3] bg-[#6AD7A3]" : "border-[#2A3544]"
                  }`}>
                    {isSelected && (
                      <svg viewBox="0 0 24 24" className="h-3 w-3 text-[#0C1016]" fill="none" stroke="currentColor" strokeWidth={3}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6AD7A3]/10 text-xs font-bold text-[#6AD7A3]">
                    {c.display_name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{c.display_name}</div>
                    <div className="text-[11px] text-[#9CA3AF]">{c.email}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Free email pills */}
          {freeEmails.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {freeEmails.map((email) => (
                <button
                  key={email}
                  onClick={() => setFreeEmails((prev) => prev.filter((e) => e !== email))}
                  className="flex items-center gap-1.5 rounded-full bg-[#B8BFC8]/10 px-3 py-1 text-[12px] text-[#B8BFC8] transition hover:bg-[#B8BFC8]/20"
                >
                  {email}
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Free type email */}
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              value={freeEmailInput}
              onChange={(e) => setFreeEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const email = freeEmailInput.trim().toLowerCase();
                  if (email && email.includes("@") && !freeEmails.includes(email)) {
                    setFreeEmails((prev) => [...prev, email]);
                    setFreeEmailInput("");
                  }
                }
              }}
              className="flex-1 rounded-lg border border-dashed border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
              placeholder="Or type an email address..."
            />
            <button
              type="button"
              onClick={() => {
                const email = freeEmailInput.trim().toLowerCase();
                if (email && email.includes("@") && !freeEmails.includes(email)) {
                  setFreeEmails((prev) => [...prev, email]);
                  setFreeEmailInput("");
                }
              }}
              disabled={!freeEmailInput.trim() || !freeEmailInput.includes("@")}
              className="shrink-0 rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm font-medium text-[#6AD7A3] transition hover:bg-[#6AD7A3]/10 disabled:opacity-30 disabled:pointer-events-none"
            >
              Add
            </button>
          </div>

          {/* Next button */}
          <button
            onClick={() => setStep("template")}
            disabled={totalRecipients === 0}
            className="w-full rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] py-2.5 text-sm font-semibold text-[#0C1016] transition disabled:opacity-30"
          >
            Next - Choose Template ({totalRecipients} selected)
          </button>
        </div>
      )}

      {/* Step 2: Template */}
      {step === "template" && (
        <div className="space-y-2">
          <div className="rounded-xl bg-[#151C24] px-3 py-2 text-sm">
            To:{" "}
            {selectedClients.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <span className="font-medium text-[#6AD7A3]">{c.display_name}</span>
              </span>
            ))}
            {freeEmails.map((email, i) => (
              <span key={email}>
                {(i > 0 || selectedClients.length > 0) && ", "}
                <span className="font-medium text-[#B8BFC8]">{email}</span>
              </span>
            ))}
          </div>

          <button
            onClick={handleStartBlank}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[rgba(255,255,255,0.2)] bg-[#171F28] p-3 text-left transition hover:bg-[#222D3D]"
          >
            <span className="text-sm text-[#B8BFC8]">Start blank</span>
          </button>

          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handlePickTemplate(t)}
              className="flex w-full items-center justify-between rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-3 text-left transition hover:bg-[#222D3D]"
            >
              <div>
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-[11px] text-[#9CA3AF]">{t.subject.slice(0, 60)}</div>
              </div>
              <div className="flex gap-1">
                {t.trigger_event && (
                  <span className="rounded-full bg-[#FAD76A]/10 px-2 py-0.5 text-[10px] text-[#FAD76A]">
                    {t.trigger_event}
                  </span>
                )}
                {t.ai_prompt_hint && (
                  <span className="rounded-full bg-[#8B5CF6]/10 px-2 py-0.5 text-[10px] text-[#8B5CF6]">AI</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 3: Editor */}
      {step === "editor" && (
        <div className="space-y-3">
          {/* Recipient bar */}
          <div className="rounded-xl bg-[#151C24] px-3 py-2 text-sm">
            To:{" "}
            {selectedClients.slice(0, 3).map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <span className="font-medium text-[#6AD7A3]">{c.display_name}</span>
              </span>
            ))}
            {selectedClients.length > 3 && (
              <span className="text-[#9CA3AF]"> +{selectedClients.length - 3} more</span>
            )}
          </div>

          {drafting ? (
            <div className="rounded-xl bg-[#171F28] p-4 text-center text-sm text-[#B8BFC8]">
              <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-[#6AD7A3] border-t-transparent" />
              Generating draft...
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs text-[#9CA3AF]">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
                  placeholder="Email subject..."
                />
              </div>

              {/* Merge field pills */}
              <div className="flex flex-wrap gap-1.5">
                {MERGE_FIELDS.map((field) => (
                  <button
                    key={field}
                    onClick={() => insertMergeField(field)}
                    className="rounded-full bg-[#6AD7A3]/10 px-2.5 py-0.5 text-[11px] text-[#6AD7A3] transition hover:bg-[#6AD7A3]/20"
                  >
                    {field}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#9CA3AF]">Body</label>
                <textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3]"
                  placeholder="Write your message..."
                />
              </div>

              <div className="flex gap-2">
                {selectedClients.length === 1 && (
                  <button
                    onClick={handleRefineWithAI}
                    disabled={drafting || !body}
                    className="rounded-full border border-[#6AD7A3]/30 px-4 py-2 text-sm text-[#6AD7A3] transition hover:bg-[#6AD7A3]/10 disabled:opacity-40"
                  >
                    {drafting ? "Refining..." : "Refine with AI"}
                  </button>
                )}

                <button
                  onClick={handleSend}
                  disabled={sending || !subject || !body}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-6 py-2 text-sm font-semibold text-[#0C1016] transition disabled:opacity-40"
                >
                  <Send size={16} strokeWidth={2} />
                  {sending
                    ? "Sending..."
                    : selectedClients.length > 1
                      ? `Send to ${selectedClients.length}`
                      : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  CONVERSATIONS VIEW                                                 */
/* ================================================================== */

function ConversationsView({
  clients,
  showToast,
}: {
  clients: Client[];
  showToast: (msg: string) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  // Thread view
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  // (Reply state is now per-thread via ThreadReplyBox)

  // Thread expansion state
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [replyingToThread, setReplyingToThread] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    setLoading(true);
    const res = await fetch("/api/admin/messages/conversations");
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations ?? []);
    }
    setLoading(false);
  }

  async function pollReplies() {
    setPolling(true);
    const res = await fetch("/api/admin/messages/poll-replies", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      showToast(
        data.new_replies > 0
          ? `${data.new_replies} new repl${data.new_replies !== 1 ? "ies" : "y"} found`
          : "No new replies",
      );
      await loadConversations();
      if (selectedClientId) await loadThread(selectedClientId);
    } else {
      showToast("Something went wrong - check Logs");
    }
    setPolling(false);
  }

  async function loadThread(clientId: string) {
    setThreadLoading(true);
    const res = await fetch(`/api/admin/messages/conversations/${clientId}`);
    if (res.ok) {
      const data = await res.json();
      setThread(data.messages ?? []);
      setSelectedClientName(data.client?.display_name || "Removed User");
    }
    setThreadLoading(false);
  }

  function openThread(conv: Conversation) {
    if (!conv.client_id) return;
    setSelectedClientId(conv.client_id);
    loadThread(conv.client_id);
  }

  function closeThread() {
    setSelectedClientId(null);
    setThread([]);
    setExpandedThreads(new Set());
    setReplyingToThread(null);
    loadConversations();
  }

  // Reply is now handled per-thread via ThreadReplyBox

  // Group messages by subject thread, newest thread first
  function groupByThread(messages: ThreadMessage[]) {
    const groups = new Map<string, ThreadMessage[]>();
    for (const msg of messages) {
      // Normalize subject: strip "Re: " prefixes for grouping
      const baseSubject = (msg.subject || "(no subject)")
        .replace(/^(Re:\s*)+/i, "")
        .trim() || "(no subject)";
      const existing = groups.get(baseSubject) ?? [];
      existing.push(msg);
      groups.set(baseSubject, existing);
    }
    // Sort messages within each group: newest first
    for (const msgs of groups.values()) {
      msgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    // Sort groups by their newest message: newest thread first
    const sorted = [...groups.entries()].sort((a, b) => {
      const aNewest = new Date(a[1][0].timestamp).getTime();
      const bNewest = new Date(b[1][0].timestamp).getTime();
      return bNewest - aNewest;
    });
    return sorted;
  }

  // Strip quoted email text from reply body
  function stripQuotedText(body: string): string {
    const lines = body.split("\n");
    const cleaned: string[] = [];
    for (const line of lines) {
      // Stop at quoted content markers
      if (/^On .+ wrote:$/i.test(line.trim())) break;
      if (/^>/.test(line.trim())) break;
      if (/^-{3,}/.test(line.trim()) && cleaned.length > 0) break;
      if (/^_{3,}/.test(line.trim()) && cleaned.length > 0) break;
      cleaned.push(line);
    }
    // Trim trailing empty lines
    while (cleaned.length > 0 && cleaned[cleaned.length - 1].trim() === "") {
      cleaned.pop();
    }
    return cleaned.join("\n") || body;
  }

  /* -- Thread view -- */
  if (selectedClientId) {
    const threadGroups = groupByThread(thread);

    // Auto-expand all threads on first load
    if (expandedThreads.size === 0 && threadGroups.length > 0) {
      const allSubjects = new Set(threadGroups.map(([subject]) => subject));
      if (allSubjects.size > 0) setExpandedThreads(allSubjects);
    }

    function toggleThread(subject: string) {
      setExpandedThreads((prev) => {
        const next = new Set(prev);
        if (next.has(subject)) next.delete(subject);
        else next.add(subject);
        return next;
      });
    }

    return (
      <div className="flex flex-col space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={closeThread} className="text-[#9CA3AF] hover:text-white">
            <BackArrow />
          </button>
          <h2 className="text-lg font-semibold">{selectedClientName}</h2>
        </div>

        {threadLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[#171F28]" />
            ))}
          </div>
        ) : thread.length === 0 ? (
          <div className="rounded-xl bg-[#171F28] p-6 text-center text-sm text-[#9CA3AF]">
            No messages in this conversation yet
          </div>
        ) : (
          <div className="space-y-4">
            {threadGroups.map(([subject, messages]) => {
              const isExpanded = expandedThreads.has(subject);
              const hasReply = messages.some((m) => m.direction === "received");
              const newestMsg = messages[0];

              return (
                <div key={subject} className="rounded-2xl border border-[#2A3544]/60 bg-[#0C1016] overflow-hidden">
                  {/* Thread header - gold accent */}
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
                        {messages.length} message{messages.length !== 1 ? "s" : ""} &middot; {formatTimeAgo(new Date(newestMsg.timestamp))}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyingToThread(replyingToThread === subject ? null : subject);
                          if (!isExpanded) toggleThread(subject);
                        }}
                        className="rounded-full p-1.5 text-[#6B7280] transition hover:bg-[#6AD7A3]/10 hover:text-[#6AD7A3]"
                        title="Reply in this thread"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                          <polyline points="9 17 4 12 9 7" />
                          <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                        </svg>
                      </button>
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 text-[#6B7280] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </button>

                  {/* Messages + per-thread reply box */}
                  {isExpanded && (
                    <div className="border-t border-[#2A3544]/40 bg-[#111820] rounded-b-2xl px-3 pb-3 pt-2 space-y-2">
                      {messages.map((msg) => {
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
                                  <span className="text-[10px] font-medium uppercase tracking-wider text-[#6B7280]">You</span>
                                ) : (
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6AD7A3]">
                                    {selectedClientName}
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

                      {/* Per-thread reply box - shown when reply icon is clicked */}
                      {replyingToThread === subject && (
                        <ThreadReplyBox
                          subject={subject}
                          clientId={selectedClientId!}
                          threadMessages={messages}
                          clientName={selectedClientName}
                          onSent={() => loadThread(selectedClientId!)}
                          onClose={() => setReplyingToThread(null)}
                          showToast={showToast}
                        />
                      )}
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

  /* -- Conversation list -- */
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Conversations</h2>
        <button
          onClick={pollReplies}
          disabled={polling}
          className="rounded-full border border-[#6AD7A3]/30 px-4 py-1.5 text-sm text-[#6AD7A3] transition hover:bg-[#6AD7A3]/10 disabled:opacity-40"
        >
          {polling ? "Checking..." : "Check for Replies"}
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#171F28]" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-[#171F28] p-12 text-center">
          <svg viewBox="0 0 24 24" className="mb-3 h-10 w-10 text-[#2A3544]" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-sm font-medium text-[#B8BFC8]">No conversations yet</p>
          <p className="mt-1 text-[11px] text-[#6B7280]">Send a message to start a conversation</p>
        </div>
      ) : (
        <div className="space-y-1">
          {conversations.map((conv) => (
            <button
              key={conv.client_id || conv.email}
              onClick={() => openThread(conv)}
              className="flex w-full items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#171F28] p-3 text-left transition hover:bg-[#222D3D]"
            >
              <div className="relative">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${conv.display_name ? "bg-[#6AD7A3]/10 text-[#6AD7A3]" : "bg-[#9CA3AF]/10 text-[#9CA3AF]"}`}>
                  {conv.display_name ? conv.display_name[0]?.toUpperCase() : "-"}
                </div>
                {conv.unread_count > 0 && (
                  <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[#6AD7A3] border-2 border-[#171F28]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">
                    {conv.display_name || <span className="rounded-full bg-[#9CA3AF]/10 px-2 py-0.5 text-[11px] text-[#9CA3AF] ring-1 ring-[#9CA3AF]/20">Removed User</span>}
                  </span>
                  <span className="ml-2 text-[10px] text-[#6B7280] whitespace-nowrap">
                    {formatTimeAgo(new Date(conv.last_message_at))}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {conv.last_direction === "sent" && (
                    <span className="text-[10px] text-[#9CA3AF]">You:</span>
                  )}
                  <p className="truncate text-[12px] text-[#9CA3AF]">
                    {conv.last_message_preview}
                  </p>
                </div>
              </div>
              {conv.unread_count > 0 && (
                <span className="rounded-full bg-[#6AD7A3] px-1.5 py-0.5 text-[10px] font-bold text-[#0C1016]">
                  {conv.unread_count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Thread Reply Box                                                   */
/* ================================================================== */

function ThreadReplyBox({
  subject,
  clientId,
  threadMessages,
  clientName,
  onSent,
  onClose,
  showToast,
}: {
  subject: string;
  clientId: string;
  threadMessages: ThreadMessage[];
  clientName: string;
  onSent: () => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [refining, setRefining] = useState(false);

  // Build thread context for AI refinement
  function buildThreadContext(): string {
    // Chronological order (oldest first) for context, take last 6 messages max
    const sorted = [...threadMessages]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-6);
    return sorted
      .map((m) => `${m.direction === "sent" ? "Coach (Josh)" : clientName}: ${m.body.slice(0, 300)}`)
      .join("\n\n");
  }

  async function handleRefine() {
    if (!body || refining) return;
    setRefining(true);

    const res = await fetch("/api/admin/messages/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        refine_body: body,
        thread_context: buildThreadContext(),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.body) setBody(data.body);
    }
    setRefining(false);
  }

  async function handleSend() {
    if (!body || sending) return;
    setSending(true);

    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

    // Find the most recent message with a message_id for threading
    const sortedByTime = [...threadMessages].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const latestWithId = sortedByTime.find((m) => m.message_id);

    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        subject: replySubject,
        body,
        ...(latestWithId?.message_id && { in_reply_to: latestWithId.message_id }),
      }),
    });

    if (res.ok) {
      const result = await res.json();
      showToast(result.sent ? "Reply sent!" : result.error || "Saved");
      setBody("");
      onSent();
      onClose();
    } else {
      showToast("Failed to send reply");
    }
    setSending(false);
  }

  return (
    <div className="mt-2 rounded-xl border border-[#2A3544] bg-[#0C1016] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#6B7280]">
          Replying to: <span className="text-[#FAD76A]">{subject}</span>
        </span>
        <button
          onClick={onClose}
          className="text-[#6B7280] hover:text-white transition"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-[#2A3544] bg-[#151C24] px-3 py-2 text-sm text-white outline-none focus:border-[#6AD7A3] placeholder-[#4B5563]"
        placeholder="Write your reply..."
        autoFocus
      />
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={handleRefine}
          disabled={refining || !body}
          className="rounded-full border border-[#6AD7A3]/30 px-3 py-1.5 text-[12px] text-[#6AD7A3] transition hover:bg-[#6AD7A3]/10 disabled:opacity-40"
        >
          {refining ? "Refining..." : "Refine with AI"}
        </button>
        <button
          onClick={handleSend}
          disabled={sending || !body}
          className="rounded-full bg-gradient-to-r from-[#A9FFB5] via-[#5EF2C7] to-[#39D6FF] px-5 py-1.5 text-[12px] font-semibold text-[#0C1016] transition disabled:opacity-40"
        >
          {sending ? "Sending..." : "Reply"}
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Shared components & utilities                                      */
/* ================================================================== */

function BackArrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
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
