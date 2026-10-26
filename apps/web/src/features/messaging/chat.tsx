"use client";
import { ArrowLeft, Database, MessageSquare, Paperclip, Search, Send, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, EmptyState, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { TOPIC_LABEL, type Attachment, type Conversation, type Msg } from "./types";

const fmtTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Shows who is talking: staff get an explicit identity badge so users know they are speaking to DataHub. */
export function IdentityBadge({ role }: { role?: Msg["authorRole"] }) {
  if (!role || role === "Contributor") return null;
  return <Badge tone={role === "Reviewer" ? "brand" : "success"}><ShieldCheck size={11} aria-hidden />{role === "Support" ? "DataHub Support" : role === "Administrator" ? "DataHub Admin" : "Reviewer"}</Badge>;
}

type Filter = "all" | "unread" | "dataset" | "support";
/** Generic conversation sidebar. Reused by the contributor inbox and the admin inbox. */
export function ConversationList({ conversations, activeId, onSelect, action, className }: {
  conversations: Conversation[]; activeId?: string; onSelect: (id: string) => void; action?: ReactNode; className?: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useMemo(() => conversations
    .filter((c) => (filter === "unread" ? c.unread > 0 : filter === "dataset" ? !!c.datasetId : filter === "support" ? !c.datasetId : true))
    .filter((c) => !q || `${c.subject} ${c.counterpart.name} ${c.datasetId ?? ""} ${c.messages.at(-1)?.body ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [conversations, q, filter]);
  const unreadTotal = conversations.reduce((a, c) => a + (c.unread > 0 ? 1 : 0), 0);
  const chips: Array<[Filter, string]> = [["all", "All"], ["unread", `Unread${unreadTotal ? ` (${unreadTotal})` : ""}`], ["dataset", "Datasets"], ["support", "Support"]];
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="space-y-3 border-b border-line p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <Input aria-label="Search conversations" placeholder="Search conversations" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {action}
        </div>
        <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Filter conversations">
          {chips.map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id}
              className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors", filter === id ? "bg-brand text-white" : "bg-surface2 text-muted hover:text-fg")}>{label}</button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? <EmptyState icon={MessageSquare} title="No conversations" description={q || filter !== "all" ? "Nothing matches your search or filter." : "Start a conversation with the DataHub team."} />
        : (
          <ul className="scroll-thin min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {rows.map((c) => {
              const last = c.messages.at(-1);
              return (
                <li key={c.id}>
                  <button onClick={() => onSelect(c.id)} aria-current={c.id === activeId ? "true" : undefined}
                    className={cn("flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-surface2/60", c.id === activeId && "bg-brand-soft")}>
                    <Avatar name={c.counterpart.name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.subject}</span>
                        <span className="shrink-0 text-[11px] text-muted">{fmtShort(c.updatedAt)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <span className="truncate">{c.counterpart.name}</span>
                        {c.datasetId && <span className="inline-flex items-center gap-1 rounded bg-surface2 px-1.5 py-0.5 text-[10px] font-medium"><Database size={10} aria-hidden />{c.datasetId}</span>}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className={cn("truncate text-xs", c.unread ? "text-fg" : "text-muted")}>{last ? `${last.authorId === c.counterpart.id ? "" : "You: "}${last.body}` : "No messages yet"}</span>
                        {c.unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white" aria-label={`${c.unread} unread`}>{c.unread}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}

/** Generic chat window. `viewerId` decides which side is "mine"; `onSend` persists the message. */
export function ChatThread({ conversation, viewerId, onSend, typing, onBack, headerExtra, className }: {
  conversation: Conversation; viewerId: string; onSend: (body: string, attachments: Attachment[]) => void; typing?: boolean;
  onBack?: () => void; headerExtra?: ReactNode; className?: string;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const c = conversation;
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [c.messages.length, typing, c.id]);
  const send = () => {
    if (!text.trim() && files.length === 0) { setErr("Write a message or attach a file first."); return; }
    if (text.length > 2000) { setErr("Messages are limited to 2,000 characters."); return; }
    onSend(text.trim(), files); setText(""); setFiles([]); setErr("");
  };
  return (
    <section className={cn("flex min-h-0 flex-col", className)} aria-label={`Conversation: ${c.subject}`}>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        {onBack && <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Back to conversations"><ArrowLeft size={16} /></Button>}
        <Avatar name={c.counterpart.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold">{c.subject}</h2><IdentityBadge role={c.counterpart.role} /></div>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">{c.counterpart.name} · {TOPIC_LABEL[c.topic]}
            {c.datasetId && <Link href={`/datasets/${c.datasetId}`} className="inline-flex items-center gap-1 text-brand hover:underline"><Database size={11} aria-hidden />{c.datasetId}</Link>}</p>
        </div>
        {headerExtra}
      </header>
      <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto bg-bg/50 p-4" role="log" aria-live="polite" aria-label="Messages">
        {c.messages.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello below.</p>}
        {c.messages.map((m) => {
          const mine = m.authorId === viewerId;
          return (
            <div key={m.id} className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
              <Avatar name={m.authorName} size={28} />
              <div className={cn("flex max-w-[80%] flex-col gap-1", mine && "items-end")}>
                <div className={cn("flex flex-wrap items-center gap-2 text-xs text-muted", mine && "flex-row-reverse")}>
                  <span className="font-medium text-fg">{mine ? "You" : m.authorName}</span>{!mine && <IdentityBadge role={m.authorRole} />}<time dateTime={m.at}>{fmtTime(m.at)}</time>
                </div>
                {m.body && <p className={cn("whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-tr-sm bg-brand text-white" : "rounded-tl-sm border border-line bg-surface")}>{m.body}</p>}
                {m.attachments?.map((a) => (
                  <span key={a.name} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs"><Paperclip size={12} aria-hidden />{a.name}<span className="text-muted">{a.sizeKb} KB</span></span>
                ))}
              </div>
            </div>
          );
        })}
        {typing && <p className="text-xs text-muted" role="status"><span className="inline-flex gap-1 align-middle" aria-hidden><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" /></span> {c.counterpart.name} is typing…</p>}
        <div ref={endRef} />
      </div>
      <footer className="border-t border-line p-3">
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">{files.map((f) => (
            <span key={f.name} className="inline-flex items-center gap-1.5 rounded-full bg-surface2 py-1 pl-2.5 pr-1 text-xs">{f.name}
              <button aria-label={`Remove ${f.name}`} className="rounded-full p-0.5 hover:bg-line" onClick={() => setFiles(files.filter((x) => x !== f))}><X size={12} /></button></span>))}</div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} aria-label="Attach a file" onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            if (f.size > 10 * 1048576) setErr("Attachments are limited to 10 MB."); else { setFiles((p) => [...p, { name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) }]); setErr(""); }
            e.target.value = "";
          }} />
          <Button variant="ghost" size="icon" aria-label="Attach file" onClick={() => fileRef.current?.click()}><Paperclip size={16} /></Button>
          <textarea aria-label="Message" rows={1} value={text} placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
            onChange={(e) => { setText(e.target.value); if (err) setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted/70 hover:border-muted/50 focus-visible:border-brand" />
          <Button onClick={send} aria-label="Send message"><Send size={14} />Send</Button>
        </div>
        {err && <p role="alert" className="mt-1.5 text-xs text-danger">{err}</p>}
        <p className="mt-1.5 text-[11px] text-muted">Demo mode: messages are stored in this browser only. Attachments are not uploaded.</p>
      </footer>
    </section>
  );
}
