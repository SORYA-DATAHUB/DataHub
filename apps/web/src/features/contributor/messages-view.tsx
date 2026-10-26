"use client";
import { Banknote, Database, LifeBuoy, MessageSquarePlus, ShieldCheck } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal, useUI } from "@/components/ui/overlays";
import { Card, ErrorState, Field, Input, Select, Skeleton, Textarea, PageHeader, EmptyState } from "@/components/ui/primitives";
import { useFakeLoad } from "@/lib/demo";
import { ChatThread, ConversationList } from "@/features/messaging/chat";
import { useConversations } from "@/features/messaging/store";
import { TOPIC_LABEL, type Conversation, type Topic } from "@/features/messaging/types";
import { useDatasets } from "./hooks";
import { convoSeeds, ME_ID } from "./messages-seed";

const REPLY = "Thanks for your message. This is a demo auto-reply: in production a DataHub team member would answer within one business day.";
const TOPICS: Array<{ topic: Topic; icon: typeof LifeBuoy; title: string; text: string }> = [
  { topic: "payout", icon: Banknote, title: "Payout question", text: "Withdrawals, methods and payment status" },
  { topic: "account", icon: ShieldCheck, title: "Verification help", text: "Identity and eligibility to withdraw" },
  { topic: "dataset", icon: Database, title: "Dataset review", text: "Feedback, rejections and resubmitting" },
  { topic: "support", icon: LifeBuoy, title: "Technical support", text: "Uploads, errors and accessing your account" }
];

export function MessagesView() {
  const router = useRouter();
  const activeId = useParams<{ id?: string }>().id;
  const { toast } = useUI();
  const loading = useFakeLoad(500);
  const { conversations, send, markRead, create } = useConversations("contrib:convos", convoSeeds);
  const { datasets } = useDatasets();
  const [dlg, setDlg] = useState<Topic | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const active = conversations.find((c) => c.id === activeId);
  useEffect(() => { if (active && active.unread > 0) markRead(active.id); }, [active, markRead]);
  useEffect(() => { const t = timers.current; return () => t.forEach(clearTimeout); }, []);

  const reply = (c: Conversation) => {
    setTyping(c.id);
    timers.current.push(window.setTimeout(() => {
      send(c.id, { id: `m-${Date.now()}`, authorId: c.counterpart.id, authorName: c.counterpart.name, authorRole: c.counterpart.role === "Contributor" ? undefined : c.counterpart.role, body: REPLY, at: new Date().toISOString() });
      setTyping(null);
    }, 1800));
  };
  const onSend = (c: Conversation, body: string, attachments: { name: string; sizeKb: number }[]) => {
    send(c.id, { id: `m-${Date.now()}`, authorId: ME_ID, authorName: "Sokha Chan", authorRole: "Contributor", body, at: new Date().toISOString(), attachments: attachments.length ? attachments : undefined });
    reply(c);
  };

  return (
    <>
      <PageHeader title="Messages" description="Talk to reviewers and the DataHub support team. Replies about a dataset stay linked to it."
        actions={<Button onClick={() => setDlg("support")}><MessageSquarePlus size={14} />New message</Button>} />
      {loading ? <Card className="grid h-[520px] gap-0 md:grid-cols-[340px_1fr]"><div className="space-y-3 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div><Skeleton className="m-4 hidden md:block" /></Card> : (
        <Card className="grid h-[calc(100dvh-14rem)] min-h-[520px] overflow-hidden md:grid-cols-[340px_1fr]">
          <ConversationList className={`border-r border-line ${activeId ? "hidden md:flex" : "flex"}`} conversations={conversations} activeId={activeId} onSelect={(id) => router.push(`/messages/${id}`)} />
          <div className={`min-h-0 min-w-0 ${activeId ? "flex" : "hidden md:flex"} flex-col`}>
            {active ? <ChatThread className="flex-1" conversation={active} viewerId={ME_ID} typing={typing === active.id} onBack={() => router.push("/messages")} onSend={(b, a) => onSend(active, b, a)} />
              : activeId ? <ErrorState title="Conversation not found" description="It may have been removed or the link is wrong." onRetry={() => router.push("/messages")} />
              : conversations.length === 0 ? <EmptyState title="No messages yet" description="Start a conversation with the DataHub team." action={<Button onClick={() => setDlg("support")}>New message</Button>} />
              : (
                <div className="flex flex-1 flex-col justify-center p-6">
                  <h2 className="text-base font-semibold">Select a conversation or start a new one</h2>
                  <p className="mt-1 text-sm text-muted">Pick a topic so the right team member sees it first.</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">{TOPICS.map((t) => (
                    <button key={t.topic} onClick={() => setDlg(t.topic)} className="flex items-start gap-3 rounded-xl border border-line p-4 text-left transition-colors hover:border-brand hover:bg-brand-soft/50">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><t.icon size={16} /></span>
                      <span><span className="block text-sm font-medium">{t.title}</span><span className="text-xs text-muted">{t.text}</span></span>
                    </button>))}</div>
                </div>)}
          </div>
        </Card>
      )}
      <NewConversation topic={dlg} onClose={() => setDlg(null)} datasets={datasets.map((d) => ({ id: d.id, title: d.title }))} onCreate={(c) => {
        create(c); setDlg(null); toast("Message sent. Demo mode: a simulated reply will arrive shortly.");
        router.push(`/messages/${c.id}`); reply(c);
      }} />
    </>
  );
}

function NewConversation({ topic, onClose, datasets, onCreate }: { topic: Topic | null; onClose: () => void; datasets: Array<{ id: string; title: string }>; onCreate: (c: Conversation) => void }) {
  const [t, setT] = useState<Topic>("support");
  const [subject, setSubject] = useState("");
  const [dataset, setDataset] = useState("");
  const [body, setBody] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => { if (topic) { setT(topic); setSubject(""); setBody(""); setDataset(""); setErrs({}); } }, [topic]);
  const submit = () => {
    const e: Record<string, string> = {};
    if (subject.trim().length < 3) e.subject = "Enter a subject (at least 3 characters).";
    if (body.trim().length < 10) e.body = "Describe your question in at least 10 characters.";
    if (t === "dataset" && !dataset) e.dataset = "Choose the dataset this is about.";
    setErrs(e); if (Object.keys(e).length) return;
    const at = new Date().toISOString();
    const reviewer = t === "dataset";
    onCreate({
      id: `c-${Date.now()}`, subject: subject.trim(), topic: t, datasetId: t === "dataset" ? dataset : undefined, unread: 0, updatedAt: at,
      counterpart: reviewer ? { id: "u-4", name: "Vireak Ly", role: "Reviewer" } : { id: "s-1", name: "DataHub Support", role: "Support" },
      messages: [{ id: "m1", authorId: ME_ID, authorName: "Sokha Chan", authorRole: "Contributor", body: body.trim(), at }]
    });
  };
  return (
    <Modal open={topic !== null} onClose={onClose} title="New message" description="We usually reply within one business day."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit}>Send message</Button></>}>
      <div className="space-y-4">
        <Field label="Topic" required>{(id) => <Select id={id} value={t} onChange={(e) => setT(e.target.value as Topic)}>{(Object.keys(TOPIC_LABEL) as Topic[]).map((k) => <option key={k} value={k}>{TOPIC_LABEL[k]}</option>)}</Select>}</Field>
        {t === "dataset" && <Field label="Dataset" required error={errs.dataset}>{(id, d) => <Select id={id} aria-describedby={d} aria-invalid={!!errs.dataset} value={dataset} onChange={(e) => setDataset(e.target.value)}><option value="">Select a dataset</option>{datasets.map((x) => <option key={x.id} value={x.id}>{x.id}: {x.title}</option>)}</Select>}</Field>}
        <Field label="Subject" required error={errs.subject}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.subject} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />}</Field>
        <Field label="Message" required error={errs.body} hint="Never include passwords or full bank card numbers.">{(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errs.body} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />}</Field>
      </div>
    </Modal>
  );
}
