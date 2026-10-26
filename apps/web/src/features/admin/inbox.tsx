"use client";
import { ArrowLeft, CheckCheck, Info, Paperclip, Plus, Search, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, Modal, useUI } from "@/components/ui/overlays";
import { Avatar, Badge, Card, EmptyState, Field, Input, Select, Skeleton, StatusBadge, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useDemoState, useFakeLoad } from "@/lib/demo";
import { datasetById } from "@/mock/data";
import { PageHeader } from "@/components/ui/primitives";
import { useQueryParam } from "./common";
import { conversationsSeed, gb, REVIEWERS, usd, userById, type Conversation } from "./data";
import { useUsers } from "./state";

export function AdminInbox({ activeId }: { activeId?: string }) {
  const { toast } = useUI();
  const router = useRouter();
  const { users } = useUsers();
  const loading = useFakeLoad(400);
  const [convs, setConvs] = useDemoState<Conversation[]>("admin-conversations", conversationsSeed);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "open" | "closed">("all");
  const [composeUser] = useQueryParam("compose");
  const [composeDs] = useQueryParam("dataset");
  const [, setCompose] = useQueryParam("compose");
  const [ctx, setCtx] = useState(false);
  const active = convs.find((c) => c.id === activeId);

  useEffect(() => {
    if (active?.unread) setConvs((l) => l.map((c) => (c.id === active.id ? { ...c, unread: false } : c)));
  }, [active?.id, active?.unread, setConvs]);

  const list = convs.filter((c) => {
    const u = userById(c.userId);
    if (filter === "unread" && !c.unread) return false;
    if ((filter === "open" || filter === "closed") && c.status !== filter) return false;
    return !q || `${c.subject} ${u?.name} ${c.datasetId ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });
  const unreadCount = convs.filter((c) => c.unread).length;
  const upd = (id: string, p: Partial<Conversation>) => setConvs((l) => l.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const send = (c: Conversation, text: string, attachment?: string) => {
    upd(c.id, { messages: [...c.messages, { id: String(Date.now()), from: "admin", author: "Anna Keller", text, time: "Just now", attachment }], updated: "2026-10-26 now", assignee: c.assignee ?? "Anna Keller" });
    toast("Message sent (simulated).");
  };

  const listPane = (
    <div className={cn("min-h-0 flex-col border-line lg:flex lg:border-r", activeId ? "hidden" : "flex")}>
      <div className="space-y-2 border-b border-line p-3">
        <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search conversations" placeholder="Search conversations…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex gap-1.5" role="group" aria-label="Conversation filter">
          {(["all", "unread", "open", "closed"] as const).map((f) => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", filter === f ? "bg-brand-soft text-brand" : "bg-surface2 text-muted hover:text-fg")}>{f[0].toUpperCase() + f.slice(1)}{f === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}</button>)}
        </div>
      </div>
      <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 && <li><EmptyState icon={Search} title="No conversations" description="Nothing matches this filter." action={<Button variant="outline" onClick={() => { setQ(""); setFilter("all"); }}>Reset</Button>} /></li>}
        {list.map((c) => { const u = userById(c.userId); const last = c.messages[c.messages.length - 1]; return (
          <li key={c.id}><Link href={`/admin/messages/${c.id}`} aria-current={c.id === activeId ? "page" : undefined} className={cn("flex gap-3 border-b border-line px-4 py-3 hover:bg-surface2/60", c.id === activeId && "bg-brand-soft/60")}>
            <Avatar name={u?.name ?? "?"} size={36} />
            <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{u?.name}</p>{c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}</div>
              <p className="truncate text-xs">{c.subject}</p><p className="truncate text-xs text-muted">{last.text}</p>
              <div className="mt-1 flex gap-1.5"><StatusBadge status={c.status} />{c.datasetId && <Badge>{c.datasetId}</Badge>}</div></div>
          </Link></li>); })}
      </ul>
    </div>
  );

  return (
    <>
      <PageHeader title="Messages" description="Support inbox for contributor conversations." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Messages" }]}
        actions={<Button onClick={() => setCompose(users[0]?.id ?? "u-1")}><Plus size={14} />New message</Button>} />
      {loading ? <Card className="space-y-3 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14" />)}</Card> : (
        <Card className="grid h-[calc(100dvh-14rem)] min-h-[480px] overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px]">
          {listPane}
          {activeId ? (active ? <Thread c={active} onSend={(t, a) => send(active, t, a)} onUpdate={(p) => upd(active.id, p)} onCtx={() => setCtx(true)} /> :
            <div className="flex items-center justify-center"><EmptyState title="Conversation not found" description="It may have been removed." action={<Button variant="outline" href="/admin/messages">Back to inbox</Button>} /></div>)
            : <div className="hidden items-center justify-center lg:flex"><EmptyState icon={Send} title="Select a conversation" description="Choose a thread from the list to read and reply." /></div>}
          {active && <aside className="scroll-thin hidden overflow-y-auto border-l border-line xl:block"><Context c={active} /></aside>}
        </Card>
      )}
      {active && <Drawer open={ctx} onClose={() => setCtx(false)} title="Contributor and dataset"><Context c={active} /></Drawer>}
      <Compose open={!!composeUser} initialUser={composeUser} initialDataset={composeDs} onClose={() => setCompose(null)}
        onCreate={(userId, subject, text, datasetId) => {
          const id = `c-${Date.now()}`;
          setConvs((l) => [{ id, userId, subject, datasetId: datasetId || undefined, status: "open", assignee: "Anna Keller", unread: false, updated: "2026-10-26 now", messages: [{ id: "m1", from: "admin", author: "Anna Keller", text, time: "Just now" }] }, ...l]);
          toast("Conversation created (simulated).");
          router.push(`/admin/messages/${id}`);
        }} />
    </>
  );
}

function Thread({ c, onSend, onUpdate, onCtx }: { c: Conversation; onSend: (t: string, attachment?: string) => void; onUpdate: (p: Partial<Conversation>) => void; onCtx: () => void }) {
  const { toast, confirm } = useUI();
  const u = userById(c.userId);
  const [text, setText] = useState("");
  const [att, setAtt] = useState<string | undefined>();
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [c.messages.length]);
  const submit = () => {
    if (!text.trim()) { setErr("Write a message before sending."); return; }
    onSend(text.trim(), att); setText(""); setAtt(undefined); setErr("");
  };
  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Button variant="ghost" size="icon" href="/admin/messages" className="lg:hidden" aria-label="Back to inbox"><ArrowLeft size={16} /></Button>
        <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{c.subject}</h2><p className="truncate text-xs text-muted">{u?.name} · {c.status}</p></div>
        <Select aria-label="Assignee" className="w-36" value={c.assignee ?? ""} onChange={(e) => { onUpdate({ assignee: e.target.value || null }); toast(e.target.value ? `Assigned to ${e.target.value}.` : "Unassigned."); }}>
          <option value="">Unassigned</option>{REVIEWERS.map((r) => <option key={r}>{r}</option>)}</Select>
        <Button size="icon" variant="ghost" className="xl:hidden" aria-label="Show details" onClick={onCtx}><Info size={16} /></Button>
        {c.status === "open" ? <Button size="sm" variant="outline" onClick={async () => { if (await confirm({ title: "Close conversation?", description: "The contributor can still reply, which reopens it.", confirmLabel: "Close" })) { onUpdate({ status: "closed" }); toast("Conversation closed."); } }}><CheckCheck size={14} />Close</Button>
          : <Button size="sm" variant="outline" onClick={() => { onUpdate({ status: "open" }); toast("Conversation reopened."); }}>Reopen</Button>}
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-label="Messages">
        {c.messages.map((m) => (
          <div key={m.id} className={cn("flex", m.from === "admin" && "justify-end")}>
            <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", m.from === "admin" ? "bg-brand text-white" : "bg-surface2")}>
              <p>{m.text}</p>
              {m.attachment && <button onClick={() => toast(`Simulated download of ${m.attachment}. No real file exists.`, "info")} className="mt-1.5 flex items-center gap-1.5 rounded-md bg-black/10 px-2 py-1 text-xs"><Paperclip size={12} />{m.attachment}</button>}
              <p className={cn("mt-1 text-[11px]", m.from === "admin" ? "text-white/70" : "text-muted")}>{m.author} · {m.time}</p>
            </div>
          </div>))}
        <div ref={endRef} />
      </div>
      <div className="border-t border-line p-3">
        {err && <p role="alert" className="mb-1 text-xs text-danger">{err}</p>}
        <div className="flex items-end gap-2">
          <Textarea aria-label="Reply" aria-invalid={!!err} placeholder={c.status === "closed" ? "Replying will reopen this conversation…" : "Write a reply…"} className="min-h-10" value={text} onChange={(e) => { setText(e.target.value); setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} />
          <label className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line text-muted hover:bg-surface2" title="Attach file (name only, nothing is uploaded)">
            <Paperclip size={16} /><span className="sr-only">Attach file</span>
            <input type="file" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAtt(f.name); toast(`Attached ${f.name} (not uploaded in demo).`, "info"); } }} /></label>
          <Button onClick={() => { if (c.status === "closed" && text.trim()) onUpdate({ status: "open" }); submit(); }}><Send size={14} />Send</Button>
        </div>
        {att && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Paperclip size={12} />{att}<button className="ml-1 text-danger" onClick={() => setAtt(undefined)}>Remove</button></p>}
      </div>
    </div>
  );
}

function Context({ c }: { c: Conversation }) {
  const u = userById(c.userId);
  const d = c.datasetId ? datasetById(c.datasetId) : null;
  return (
    <div className="space-y-5 p-4">
      <div className="text-center"><Avatar name={u?.name ?? "?"} size={48} /><p className="mt-2 font-semibold">{u?.name}</p><p className="text-xs text-muted">{u?.email}</p>
        <div className="mt-2 flex justify-center gap-1.5">{u && <StatusBadge status={u.verification} />}{u && <StatusBadge status={u.status} />}</div></div>
      <dl className="space-y-1 text-sm">{[["Uploads", u?.uploads], ["Accepted", gb(u?.acceptedGb ?? 0)], ["Earnings", usd(u?.earnings ?? 0)], ["Country", u?.country]].map(([k, v]) => <div key={String(k)} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
      <Button variant="outline" size="sm" className="w-full" href={`/admin/users/${c.userId}`}>Open profile</Button>
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Dataset context</p>
        {d ? <div className="rounded-lg border border-line p-3 text-sm"><p className="font-medium">{d.title}</p><p className="text-xs text-muted">{d.id} · {gb(d.sizeGb)}</p><div className="mt-2"><StatusBadge status={d.status} /></div><Link href={`/admin/datasets/${d.id}`} className="mt-2 block text-xs text-brand hover:underline">View dataset</Link></div>
          : <p className="text-sm text-muted">No dataset linked to this conversation.</p>}</div>
    </div>
  );
}

function Compose({ open, initialUser, initialDataset, onClose, onCreate }: { open: boolean; initialUser: string; initialDataset: string; onClose: () => void; onCreate: (userId: string, subject: string, text: string, datasetId: string) => void }) {
  const { users } = useUsers();
  const [uid, setUid] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [errs, setErrs] = useState<{ subject?: string; text?: string }>({});
  const [seeded, setSeeded] = useState("");
  if (open && seeded !== initialUser) { setSeeded(initialUser); setUid(initialUser); setSubject(initialDataset ? `About ${initialDataset}` : ""); setText(""); setErrs({}); }
  if (!open && seeded) setSeeded("");
  const go = () => {
    const e: typeof errs = {};
    if (subject.trim().length < 3) e.subject = "Add a subject.";
    if (text.trim().length < 3) e.text = "Write a message.";
    setErrs(e);
    if (!Object.keys(e).length) onCreate(uid, subject.trim(), text.trim(), initialDataset);
  };
  return (
    <Modal open={open} onClose={onClose} title="New message" description="Starts a support conversation with a user."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={go}>Send</Button></>}>
      <div className="space-y-3">
        <Field label="To">{(id) => <Select id={id} value={uid} onChange={(e) => setUid(e.target.value)}>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>}</Field>
        <Field label="Subject" error={errs.subject}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.subject} value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
        <Field label="Message" error={errs.text}>{(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errs.text} value={text} onChange={(e) => setText(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}
