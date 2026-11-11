"use client";

import { useCallback, useEffect, useState } from "react";

interface Note {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

const WORKFLOW_STATUSES = [
  { value: "new", label: "New", tone: "badge-info" },
  { value: "in_progress", label: "In progress", tone: "badge-warning" },
  { value: "resolved", label: "Resolved", tone: "badge-success" },
  { value: "spam", label: "Spam", tone: "badge-danger" },
] as const;

function timeAgo(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Per-submission triage controls.
 *
 * Three capabilities that turn a raw inbox into a workflow:
 *   • **Status** — `new → in_progress → resolved → spam`.
 *   • **Internal notes** — private to the dashboard; never exported, never
 *     sent in a webhook or an email.
 *   • **Reply by email** — sends to the address captured with the
 *     submission, and nowhere else.
 */
export function SubmissionInbox({
  submissionId,
  email,
  workflowStatus,
  onStatusChange,
}: {
  submissionId: string;
  email: string | null;
  workflowStatus: string;
  onStatusChange?: (status: string) => void;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [status, setStatus] = useState(workflowStatus || "new");

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}/notes`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) setNotes(data.data.notes ?? []);
    } catch {
      /* notes are non-critical — the row still works without them */
    }
  }, [submissionId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  async function changeStatus(next: string) {
    const previous = status;
    setStatus(next);
    onStatusChange?.(next);
    try {
      const res = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowStatus: next }),
      });
      const data = await res.json();
      if (!data.ok) {
        setStatus(previous);
        setMessage({ tone: "error", text: data.message || "Could not update the status." });
      }
    } catch {
      setStatus(previous);
      setMessage({ tone: "error", text: "Network error while updating the status." });
    }
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!noteBody.trim()) return;

    setSavingNote(true);
    try {
      const res = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}/notes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
      const data = await res.json();
      if (data.ok) {
        setNotes((prev) => [data.data.note, ...prev]);
        setNoteBody("");
      } else {
        setMessage({ tone: "error", text: data.message || "Could not save the note." });
      }
    } catch {
      setMessage({ tone: "error", text: "Network error while saving the note." });
    } finally {
      setSavingNote(false);
    }
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!replyBody.trim()) return;

    setSendingReply(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}/reply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody, subject: replySubject || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setReplyBody("");
        setReplySubject("");
        setReplyOpen(false);
        setStatus((prev) => (prev === "new" ? "in_progress" : prev));
        setMessage({ tone: "ok", text: "Reply sent." });
      } else {
        setMessage({ tone: "error", text: data.message || "Could not send the reply." });
      }
    } catch {
      setMessage({ tone: "error", text: "Network error while sending the reply." });
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/8 bg-black/20 p-3.5">
      {/* Workflow status */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Workflow
        </span>
        {WORKFLOW_STATUSES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => changeStatus(option.value)}
            aria-pressed={status === option.value}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
              status === option.value
                ? option.tone
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Notes */}
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Internal notes
        </span>

        {notes.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {notes.map((note) => (
              <li
                key={note.id}
                className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2"
              >
                <p
                  className="text-xs leading-5 text-slate-200"
                  dangerouslySetInnerHTML={{ __html: note.body }}
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  {note.author} · {timeAgo(note.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addNote} className="mt-2 flex gap-2">
          <input
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Add a private note…"
            aria-label="Internal note"
            className="ff-input !py-2 !text-xs"
          />
          <button type="submit" disabled={savingNote} className="btn btn-ghost btn-sm shrink-0">
            {savingNote ? "…" : "Add"}
          </button>
        </form>
      </div>

      {/* Reply by email */}
      {email && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Reply to {email}
            </span>
            <button
              type="button"
              onClick={() => setReplyOpen((v) => !v)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-white/25 hover:text-white"
            >
              {replyOpen ? "Cancel" : "✉ Reply"}
            </button>
          </div>

          {replyOpen && (
            <form onSubmit={sendReply} className="mt-2 space-y-2">
              <input
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                placeholder="Subject (optional)"
                aria-label="Reply subject"
                className="ff-input !py-2 !text-xs"
              />
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={4}
                placeholder="Write your reply…"
                aria-label="Reply body"
                className="ff-input !py-2 !text-xs resize-y"
              />
              <div className="flex items-center gap-2">
                <button type="submit" disabled={sendingReply} className="btn btn-primary btn-sm">
                  {sendingReply ? "Sending…" : "Send reply"}
                </button>
                <span className="text-[10px] text-slate-500">
                  Delivered to the address captured with this submission.
                </span>
              </div>
            </form>
          )}
        </div>
      )}

      {message && (
        <p
          role="status"
          className={`text-[11px] font-medium ${
            message.tone === "ok" ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
