"use client";
import { AlertTriangle, ArrowLeftRight, Check, MessageSquare, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FocusShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Menu, useUI } from "@/components/ui/overlays";
import { Alert, Badge, Card, EmptyState, Select, Skeleton, StatusBadge, Textarea } from "@/components/ui/primitives";
import { cn, usd } from "@/lib/cn";
import { useDemoState, useFakeLoad, wait } from "@/lib/demo";
import { REVIEWER, TODAY, type AnnTask } from "./data";
import { BLOCKS, diff, type DiffOp } from "./doc";
import { CanvasToolbar, EditorCanvas, clampZ, type Tool, type View } from "./editor-canvas";
import { seedDoc, type Draft } from "./editor-model";
import { TaskStatusBadge, isKhmer, useQueryState } from "./shared";
import { useProjects, useReviewHistory, useTasks } from "./store";

type Version = { id: string; label: string; texts: Record<string, string>; meta: string };
const keyOf = (page: number, block: string) => `${page}:${block}`;
const CHECKS = ["Transcription matches the scan", "Khmer diacritics and numerals preserved", "Region labels are correct", "Page labels and metadata complete", "Project instructions followed"];

function buildVersions(task: AnnTask, draft: Draft | null): Version[] {
  const texts = (f: (b: (typeof BLOCKS)[number]) => string) => { const o: Record<string, string> = {}; for (let p = 0; p < task.pages; p++) for (const b of BLOCKS) if (p === 0 || !b.first) o[keyOf(p, b.id)] = f(b); return o; };
  const v1: Version = { id: "v1", label: "v1 · Machine OCR", texts: texts((b) => b.ocr), meta: "Imported OCR draft" };
  const slip = (b: (typeof BLOCKS)[number]) => (b.id === "p2" || b.id === "p4" ? b.ocr : b.truth);
  const out: Version[] = [v1, { id: "v2", label: `v2 · Submitted (attempt 1)`, texts: texts(slip), meta: "First submission" }];
  const latestTexts = draft
    ? (() => { const o: Record<string, string> = {}; draft.doc.regions.forEach((r) => { const m = /^r-(\d+)-(.+)$/.exec(r.id); o[m ? keyOf(Number(m[1]), m[2]) : r.id] = r.text; }); return o; })()
    : texts((b) => b.truth);
  if (task.attempts > 1 || draft) out.push({ id: "v3", label: `v3 · ${task.attempts > 1 ? "Resubmitted" : "Latest draft"}`, texts: latestTexts, meta: task.attempts > 1 ? "After corrections" : "Saved draft from editor" });
  return out;
}

function Ops({ ops, side }: { ops: DiffOp[]; side: "a" | "b" | "inline" }) {
  return <>{ops.map((o, i) => {
    if (o.t === "eq") return <span key={i}>{o.s}</span>;
    if (o.t === "del") return side === "b" ? null : <del key={i} className="rounded-sm bg-danger-soft text-danger">{o.s}</del>;
    return side === "a" ? null : <ins key={i} className="rounded-sm bg-success-soft text-success no-underline">{o.s}</ins>;
  })}</>;
}

export function AnnotationComparison({ taskId }: { taskId: string }) {
  const loading = useFakeLoad(600);
  const { tasks, patchTasks } = useTasks(); const { projects } = useProjects(); const { history, addRecord } = useReviewHistory();
  const { toast, confirm } = useUI(); const router = useRouter();
  const [draft] = useDemoState<Draft | null>(`ann:draft:${taskId}`, null);
  const task = tasks.find((t) => t.id === taskId); const project = projects.find((p) => p.id === task?.projectId);
  const versions = useMemo(() => (task ? buildVersions(task, draft) : []), [task, draft]);
  const defCmp = versions.length ? `${versions[Math.max(0, versions.length - 2)].id}..${versions[versions.length - 1].id}` : "v1..v2";
  const [cmp, setCmp] = useQueryState<string>("compare", defCmp);
  const [mode, setMode] = useState<"side" | "inline">("side");
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [page, setPage] = useState(0); const [tool, setTool] = useState<Tool>("pan");
  const [view, setView] = useState<View>({ z: 1, rot: 0, px: 0, py: 0 }); const [fit, setFit] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [checks, setChecks] = useState<boolean[]>(CHECKS.map(() => false)); const [score, setScore] = useState(0); const [comment, setComment] = useState(""); const [err, setErr] = useState<{ comment?: string; score?: string }>({}); const [busy, setBusy] = useState(false);

  if (loading) return <FocusShell title="Loading comparison…" backHref="/review/annotations"><div className="grid h-full grid-cols-2 gap-3 p-3"><Skeleton className="h-full" /><Skeleton className="h-full" /></div></FocusShell>;
  if (!task || !project) return <FocusShell title="Task not found" backHref="/review/annotations"><EmptyState title="Task not found" description={`No annotation task ${taskId}.`} action={<Button href="/review/annotations" variant="outline">Back to queue</Button>} /></FocusShell>;
  if (task.assignee === REVIEWER) return <FocusShell title={task.id} backHref="/review/annotations"><EmptyState icon={AlertTriangle} title="You cannot review your own work" description="Separation of duties: another reviewer must decide on this task." action={<Button href="/review/annotations" variant="outline">Back to queue</Button>} /></FocusShell>;

  const [aId, bId] = cmp.split("..");
  const A = versions.find((v) => v.id === aId) ?? versions[0]; const B = versions.find((v) => v.id === bId) ?? versions[versions.length - 1];
  const keys = [...new Set([...Object.keys(A.texts), ...Object.keys(B.texts)])].sort((x, y) => Number(x.split(":")[0]) - Number(y.split(":")[0]) || BLOCKS.findIndex((b) => b.id === x.split(":")[1]) - BLOCKS.findIndex((b) => b.id === y.split(":")[1]));
  const rows = keys.map((k) => { const a = A.texts[k] ?? "", b = B.texts[k] ?? ""; const [p, id] = k.split(":"); return { k, page: Number(p), label: BLOCKS.find((x) => x.id === id)?.label ?? "Region", id, a, b, ops: diff(a, b), changed: a !== b }; });
  const changed = rows.filter((r) => r.changed).length;
  const shown = rows.filter((r) => !onlyChanged || r.changed);
  const mine = task.reviewer === REVIEWER && task.status === "in_review";
  const regions = seedDoc(task.pages).regions.filter((r) => r.page === page);
  const reward = task.reward;
  const records = history.filter((h) => h.ref === task.id);
  const unresolved = task.feedback.filter((f) => !f.resolved);

  const claim = async () => { patchTasks([task.id], { status: "in_review", reviewer: REVIEWER }); toast(`${task.id} claimed.`); };
  const release = async () => { if (!(await confirm({ title: "Release this review?", description: "The task returns to the queue. The next reviewer starts fresh.", confirmLabel: "Release" }))) return; patchTasks([task.id], { status: "submitted", reviewer: undefined }); toast("Review released."); router.push("/review/annotations"); };
  const approve = async () => {
    const e: typeof err = {}; if (!score) e.score = "Choose a score from 1 to 5."; setErr(e); if (e.score) return;
    const missing = checks.filter((c) => !c).length;
    if (!(await confirm({ title: `Approve ${task.id}?`, confirmLabel: `Approve · credit ${usd(reward)}`, description: `${usd(reward)} will be credited to ${task.assignee}. Score ${score}/5.${missing ? ` ${missing} checklist item(s) are still unchecked.` : ""}` }))) return;
    setBusy(true); await wait(700);
    patchTasks([task.id], { status: "approved", quality: score * 20, updated: TODAY, completion: 100, feedback: comment.trim() ? [...task.feedback, { id: `${task.id}-${Date.now()}`, author: REVIEWER, at: `${TODAY} 12:00`, text: comment.trim(), resolved: true }] : task.feedback });
    addRecord({ id: `h-${Date.now()}`, kind: "annotation", subject: project.name, ref: task.id, decision: "approved", score, at: `${TODAY} 12:00`, reviewer: REVIEWER, annotator: task.assignee ?? undefined, reward });
    toast(`${task.id} approved. ${usd(reward)} credited.`); router.push("/review/annotations");
  };
  const requestChanges = async () => {
    const e: typeof err = {}; if (comment.trim().length < 10) e.comment = "Explain what must be corrected (at least 10 characters)."; setErr(e); if (e.comment) return;
    if (!(await confirm({ title: `Request corrections on ${task.id}?`, confirmLabel: "Request correction", description: `${task.assignee} will be notified and can edit and resubmit. No reward is paid until approval.` }))) return;
    setBusy(true); await wait(700);
    patchTasks([task.id], { status: "corrections_requested", quality: score ? score * 20 : null, updated: TODAY, feedback: [...task.feedback, { id: `${task.id}-${Date.now()}`, author: REVIEWER, at: `${TODAY} 12:00`, text: comment.trim() }] });
    addRecord({ id: `h-${Date.now()}`, kind: "annotation", subject: project.name, ref: task.id, decision: "corrections_requested", score: score || null, at: `${TODAY} 12:00`, reviewer: REVIEWER, annotator: task.assignee ?? undefined });
    toast("Corrections requested."); router.push("/review/annotations");
  };

  const cmpOpts = versions.flatMap((a, i) => versions.slice(i + 1).map((b) => `${a.id}..${b.id}`));
  return (
    <FocusShell backHref="/review/annotations" title={<span className="flex items-center gap-2"><span className="truncate">{project.name}</span><span className="text-muted">/</span><span className="tabular">{task.id}</span><span className="hidden text-muted md:inline">· {task.assignee} · attempt {task.attempts}</span><TaskStatusBadge status={task.status} /></span>}
      actions={mine ? <Menu label="Review actions" trigger={<span className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs font-medium hover:bg-surface2">Review ▾</span>} items={[{ label: "Release review", onClick: () => void release() }]} /> : undefined}>
      <div className="grid h-full min-h-0 grid-rows-[minmax(240px,40%)_minmax(0,1fr)] lg:grid-cols-[minmax(320px,2fr)_3fr] lg:grid-rows-1">
        {/* Source */}
        <section aria-label="Source page" className="flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
          <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted">Source</div>
          <CanvasToolbar tool={tool} setTool={setTool} view={view} zoomBy={(f) => setView((v) => ({ ...v, z: clampZ(v.z * f) }))} fit={() => setFit((n) => n + 1)} rotate={() => { setView((v) => ({ ...v, rot: (v.rot + 90) % 360 })); setTimeout(() => setFit((n) => n + 1), 0); }} page={page} total={task.pages} goto={(p) => { setPage(p); setSel(null); }} readOnly />
          <div className="min-h-0 flex-1"><EditorCanvas page={page} total={task.pages} source={task.file} regions={regions} selectedId={sel} tool="pan" view={view} setView={(f) => setView(f)} fitTick={fit} onSelect={setSel} onCreate={() => undefined} onChange={() => undefined} readOnly /></div>
        </section>
        {/* Compare + review */}
        <section aria-label="Annotation comparison" className="min-h-0 overflow-y-auto scroll-thin bg-bg">
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select aria-label="Version A" className="w-auto" value={A.id} onChange={(e) => setCmp(`${e.target.value}..${B.id}`)}>{versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</Select>
              <ArrowLeftRight size={14} className="text-muted" aria-hidden />
              <Select aria-label="Version B" className="w-auto" value={B.id} onChange={(e) => setCmp(`${A.id}..${e.target.value}`)}>{versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</Select>
              <div className="ml-auto flex gap-0.5 rounded-lg bg-surface2 p-0.5" role="group" aria-label="Diff mode">{(["side", "inline"] as const).map((m) => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("rounded-md px-3 py-1 text-xs font-medium", mode === m ? "bg-surface shadow-card" : "text-muted")}>{m === "side" ? "Side by side" : "Inline diff"}</button>)}</div>
              <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />Changed only</label>
            </div>
            {A.id === B.id && <Alert tone="warning" title="Same version selected">Choose two different versions to see changes.</Alert>}
            <p className="text-xs text-muted" aria-live="polite">{changed} of {rows.length} regions changed between {A.id} and {B.id}. {cmpOpts.length > 0 && `Quick links: ${cmpOpts.join(", ")}`}</p>

            <Card>
              {shown.length === 0 ? <EmptyState icon={Check} title="No differences" description="These two versions have identical transcriptions." /> : (
                <ul className="divide-y divide-line">{shown.map((r) => (
                  <li key={r.k} className={cn("p-3", sel === `r-${r.page}-${r.id}` && "bg-brand-soft/40")}>
                    <button onClick={() => { setPage(r.page); setSel(`r-${r.page}-${r.id}`); }} className="mb-1.5 flex w-full items-center gap-2 text-left text-xs text-muted hover:text-fg"><Badge tone={r.changed ? "warning" : "neutral"}>{r.changed ? "Changed" : "Same"}</Badge>Page {r.page + 1} · {r.label}</button>
                    {mode === "side" ? (
                      <div className="grid gap-2 sm:grid-cols-2">{(["a", "b"] as const).map((s) => <div key={s} className={cn("whitespace-pre-wrap rounded-lg border border-line bg-surface p-2.5 text-sm leading-relaxed", isKhmer(r.a + r.b) && "khmer")}><p className="mb-1 text-[11px] font-semibold uppercase text-muted">{s === "a" ? A.id : B.id}</p>{(s === "a" ? r.a : r.b) ? <Ops ops={r.ops} side={s} /> : <span className="text-muted">(empty)</span>}</div>)}</div>
                    ) : <div className={cn("whitespace-pre-wrap rounded-lg border border-line bg-surface p-2.5 text-sm leading-relaxed", isKhmer(r.a + r.b) && "khmer")}><Ops ops={r.ops} side="inline" /></div>}
                  </li>))}</ul>)}
            </Card>

            {/* Review panel */}
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Review decision</h2>
              {task.status === "submitted" ? <Alert tone="info" title="Claim this task to decide" action={<Button size="sm" onClick={() => void claim()}>Claim review</Button>}>You are viewing a read-only comparison.</Alert>
                : !mine ? <Alert tone={task.status === "approved" ? "success" : "info"} title={`This task is ${task.status.replace(/_/g, " ")}`}>{task.reviewer ? `Reviewer: ${task.reviewer}. ` : ""}Decisions can only be made by the claiming reviewer.</Alert> : (
                  <div className="space-y-4">
                    <fieldset><legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Quality checklist</legend>
                      <div className="space-y-1.5">{CHECKS.map((c, i) => <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checks[i]} onChange={() => setChecks((a) => a.map((x, j) => (j === i ? !x : x)))} />{c}</label>)}</div></fieldset>
                    <fieldset><legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Score</legend>
                      <div className="flex gap-1.5" role="radiogroup" aria-label="Score">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={score === n} onClick={() => { setScore(n); setErr((e) => ({ ...e, score: undefined })); }} className={cn("h-9 w-9 rounded-lg border text-sm font-medium", score === n ? "border-brand bg-brand text-white" : "border-line hover:bg-surface2")}>{n}</button>)}</div>
                      {err.score && <p role="alert" className="mt-1 text-xs text-danger">{err.score}</p>}</fieldset>
                    <div><label htmlFor="rc" className="mb-1.5 block text-sm font-medium">Comments to annotator</label>
                      <Textarea id="rc" value={comment} aria-invalid={!!err.comment} className="khmer" onChange={(e) => { setComment(e.target.value); setErr((x) => ({ ...x, comment: undefined })); }} placeholder="Required when requesting corrections." />
                      {err.comment && <p role="alert" className="mt-1 text-xs text-danger">{err.comment}</p>}</div>
                    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" loading={busy} onClick={() => void requestChanges()}><X size={14} />Request correction</Button><Button loading={busy} onClick={() => void approve()}><Check size={14} />Approve · {usd(reward)}</Button></div>
                  </div>)}
            </Card>

            <Card className="p-4"><h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><MessageSquare size={14} />Previous comments {unresolved.length > 0 && <Badge tone="warning">{unresolved.length} unresolved</Badge>}</h2>
              {task.feedback.length === 0 ? <p className="text-sm text-muted">No earlier comments.</p> : <ul className="space-y-2">{task.feedback.map((f) => <li key={f.id} className="rounded-lg bg-surface2 p-2.5 text-sm"><p className="mb-0.5 text-xs text-muted">{f.author} · {f.at}{f.resolved ? " · resolved" : ""}</p><p className="khmer">{f.text}</p></li>)}</ul>}</Card>
            <Card className="p-4"><h2 className="mb-2 text-sm font-semibold">Review history</h2>
              <ol className="space-y-2 text-sm">{[...records.map((r) => ({ at: r.at, text: `${r.reviewer}: ${r.decision.replace(/_/g, " ")}${r.score ? ` (${r.score}/5)` : ""}` })), { at: task.updated, text: `${task.assignee} submitted attempt ${task.attempts}` }].map((h, i) => <li key={i} className="flex justify-between gap-3"><span>{h.text}</span><span className="text-xs text-muted">{h.at}</span></li>)}</ol>
              <div className="mt-2"><StatusBadge status={task.status} /></div></Card>
          </div>
        </section>
      </div>
    </FocusShell>
  );
}
