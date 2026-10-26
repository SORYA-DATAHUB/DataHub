"use client";
import { ArrowRight, Banknote, CheckCircle2, Clock, MessageSquare, PenLine, Play, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Bars, AreaTrend } from "@/components/ui/charts";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tabs, useUI } from "@/components/ui/overlays";
import { Alert, Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { usd } from "@/lib/cn";
import { useFakeLoad } from "@/lib/demo";
import { ME, TODAY, TASK_STATUS_LABEL, type AnnTask, type TaskStatus } from "./data";
import { Deadline, TaskStatusBadge, useQueryState } from "./shared";
import { useProjects, useTasks } from "./store";

function useMine() {
  const { tasks, patchTasks } = useTasks(); const { projects } = useProjects();
  const mine = useMemo(() => tasks.filter((t) => t.assignee === ME), [tasks]);
  const pname = (id: string) => projects.find((p) => p.id === id)?.name ?? id;
  return { mine, pname, patchTasks, projects };
}
const KPIs = (m: AnnTask[]) => ({
  assigned: m.filter((t) => t.status === "assigned").length, progress: m.filter((t) => t.status === "in_progress").length,
  corrections: m.filter((t) => t.status === "corrections_requested").length, approved: m.filter((t) => t.status === "approved").length,
  rewards: m.filter((t) => t.status === "approved").reduce((s, t) => s + t.reward, 0), pending: m.filter((t) => t.status === "submitted" || t.status === "in_review").reduce((s, t) => s + t.reward, 0),
  est: m.filter((t) => ["assigned", "in_progress", "corrections_requested"].includes(t.status)).reduce((s, t) => s + t.reward, 0)
});
function PageSkeleton() { return <div className="space-y-4"><Skeleton className="h-9 w-64" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>; }

function ActionButton({ t, small = true }: { t: AnnTask; small?: boolean }) {
  const label = t.status === "assigned" ? "Start" : t.status === "in_progress" ? "Continue" : t.status === "corrections_requested" ? "Fix corrections" : "View";
  const editable = ["assigned", "in_progress", "corrections_requested"].includes(t.status);
  return <Button size={small ? "sm" : "md"} variant={editable ? "primary" : "outline"} href={editable ? `/annotate/tasks/${t.id}` : `/annotate/tasks/${t.id}`}>{editable && <Play size={12} />}{label}</Button>;
}

/* ---------------- Dashboard ---------------- */
export function AnnotatorDashboard() {
  const loading = useFakeLoad(500); const { mine, pname } = useMine();
  if (loading) return <PageSkeleton />;
  const k = KPIs(mine);
  const cont = mine.find((t) => t.status === "in_progress") ?? mine.find((t) => t.status === "corrections_requested") ?? mine.find((t) => t.status === "assigned");
  const upcoming = mine.filter((t) => ["assigned", "in_progress", "corrections_requested"].includes(t.status)).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 5);
  const week = [{ w: "Wk 38", Earned: 3.2 }, { w: "Wk 39", Earned: 4.8 }, { w: "Wk 40", Earned: 3.9 }, { w: "Wk 41", Earned: 5.6 }, { w: "Wk 42", Earned: 4.1 }, { w: "Wk 43", Earned: k.rewards + 3 }];
  return (
    <>
      <PageHeader title="Annotate" description={`Welcome back, ${ME.split(" ")[0]}. Here is where your work stands today.`} />
      {cont ? (
        <Card className="mb-6 flex flex-wrap items-center gap-4 border-brand/30 bg-brand-soft/50 p-5">
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-brand">Continue where you left off</p>
            <p className="mt-1 truncate font-semibold">{pname(cont.projectId)} · {cont.id}</p><p className="text-sm text-muted">{cont.file} · page {cont.page} · <Deadline iso={cont.deadline} /></p></div>
          <TaskStatusBadge status={cont.status} /><Button href={`/annotate/tasks/${cont.id}/edit`}><PenLine size={14} />Open editor<ArrowRight size={14} /></Button>
        </Card>
      ) : <div className="mb-6"><Alert tone="info" title="You are all caught up">No tasks need your attention. New assignments will appear here.</Alert></div>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Assigned" value={k.assigned} icon={Clock} /><Stat label="In progress" value={k.progress} icon={PenLine} tone="warning" />
        <Stat label="Corrections" value={k.corrections} icon={MessageSquare} tone={k.corrections ? "danger" : "neutral"} hint={k.corrections ? "Needs your attention" : "None open"} />
        <Stat label="Approved" value={k.approved} icon={CheckCircle2} tone="success" /><Stat label="Rewards earned" value={usd(k.rewards)} icon={Banknote} tone="success" hint={`${usd(k.pending)} pending review`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader title="Upcoming deadlines" action={<Button href="/annotate/tasks" variant="ghost" size="sm">All tasks<ArrowRight size={13} /></Button>} />
          {upcoming.length === 0 ? <EmptyState title="No open tasks" /> : <ul className="divide-y divide-line">{upcoming.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><div className="min-w-0 flex-1"><Link href={`/annotate/tasks/${t.id}`} className="font-medium hover:text-brand">{t.id}</Link><p className="truncate text-xs text-muted">{pname(t.projectId)} · {t.file}</p></div>
              <Deadline iso={t.deadline} /><span className="tabular w-14 text-right text-sm">{usd(t.reward)}</span><ActionButton t={t} /></li>))}</ul>}</Card>
        <Card><CardHeader title="Weekly rewards" description="USD, last 6 weeks" /><div className="p-4"><AreaTrend data={week} x="w" series={["Earned"]} money height={200} /></div></Card>
      </div>
    </>
  );
}

/* ---------------- My tasks ---------------- */
const TTABS = ["all", "assigned", "in_progress", "submitted", "corrections", "approved"] as const;
type TTab = (typeof TTABS)[number];
const tabMatch: Record<TTab, (s: TaskStatus) => boolean> = {
  all: () => true, assigned: (s) => s === "assigned", in_progress: (s) => s === "in_progress", submitted: (s) => s === "submitted" || s === "in_review", corrections: (s) => s === "corrections_requested", approved: (s) => s === "approved"
};
export function MyTasks() {
  const loading = useFakeLoad(500); const { mine, pname } = useMine();
  const [tab, setTab] = useQueryState<TTab>("tab", "all", TTABS);
  const rows = mine.filter((t) => tabMatch[tab](t.status));
  const cols: Column<AnnTask>[] = [
    { key: "id", header: "Task", sortValue: (t) => t.id, render: (t) => <div><Link href={`/annotate/tasks/${t.id}`} className="font-medium hover:text-brand">{t.id}</Link><p className="text-xs text-muted">{t.file} · p.{t.page}{t.pages > 1 ? `–${t.page + t.pages - 1}` : ""}</p></div> },
    { key: "p", header: "Project", sortValue: (t) => t.projectId, render: (t) => pname(t.projectId), hideOnMobile: true },
    { key: "s", header: "Status", sortValue: (t) => t.status, render: (t) => <TaskStatusBadge status={t.status} /> },
    { key: "d", header: "Deadline", sortValue: (t) => t.deadline, render: (t) => <Deadline iso={t.deadline} done={t.status === "approved"} /> },
    { key: "r", header: "Reward est.", sortValue: (t) => t.reward, render: (t) => <span className="tabular">{usd(t.reward)}</span>, className: "text-right" },
    { key: "a", header: "", className: "w-32 text-right", render: (t) => <ActionButton t={t} /> }
  ];
  const label = (k: TTab) => k === "all" ? "All" : k === "corrections" ? "Corrections" : k === "submitted" ? "Submitted" : TASK_STATUS_LABEL[k as TaskStatus];
  return (
    <>
      <PageHeader title="My tasks" description="Everything assigned to you, grouped by status." />
      <div className="mb-4"><Tabs<TTab> value={tab} onChange={setTab} tabs={TTABS.map((k) => ({ id: k, label: label(k), count: mine.filter((t) => tabMatch[k](t.status)).length }))} /></div>
      <DataTable key={tab} rows={rows} columns={cols} loading={loading} pageSize={10} searchText={(t) => `${t.id} ${t.file} ${pname(t.projectId)}`}
        empty={{ title: "No tasks here", description: tab === "all" ? "Tasks assigned to you will appear here." : "Nothing in this status right now." }} />
    </>
  );
}

/* ---------------- Task details ---------------- */
export function TaskDetails({ id }: { id: string }) {
  const loading = useFakeLoad(450); const router = useRouter(); const { toast } = useUI();
  const { mine, pname, patchTasks, projects } = useMine(); const { tasks } = useTasks();
  if (loading) return <PageSkeleton />;
  const t = tasks.find((x) => x.id === id);
  if (!t) return <Card><ErrorState title="Task not found" description={`No task with ID ${id}.`} /></Card>;
  if (t.assignee !== ME) return <Card><EmptyState title="This task is not assigned to you" description="Only the assigned annotator can open this task." action={<Button href="/annotate/tasks" variant="outline">Back to my tasks</Button>} /></Card>;
  void mine;
  const project = projects.find((p) => p.id === t.projectId);
  const editable = ["assigned", "in_progress", "corrections_requested"].includes(t.status);
  const start = () => { if (t.status === "assigned") { patchTasks([t.id], { status: "in_progress", updated: TODAY }); toast(`${t.id} started.`); } router.push(`/annotate/tasks/${t.id}/edit`); };
  const history = [
    { s: "Task created", at: "2026-10-12", done: true }, { s: "Assigned to you", at: "2026-10-14", done: true }, { s: "Started", at: t.updated, done: t.status !== "assigned" },
    { s: "Submitted for review", at: t.updated, done: ["submitted", "in_review", "approved"].includes(t.status) || t.attempts > 1 }, ...(t.attempts > 1 || t.status === "corrections_requested" ? [{ s: "Corrections requested", at: t.updated, done: true }] : []), { s: "Approved", at: t.updated, done: t.status === "approved" }
  ];
  return (
    <>
      <PageHeader title={`${t.id} · ${pname(t.projectId)}`} breadcrumbs={[{ label: "My tasks", href: "/annotate/tasks" }, { label: t.id }]} description={`${t.file} · pages ${t.page}–${t.page + t.pages - 1}`}
        actions={<><TaskStatusBadge status={t.status} />{editable ? <Button onClick={start}><Play size={14} />{t.status === "assigned" ? "Start task" : t.status === "corrections_requested" ? "Fix corrections" : "Continue"}</Button> : <Button variant="outline" onClick={() => router.push(`/annotate/tasks/${t.id}/edit`)}>View read-only</Button>}</>} />
      {t.status === "corrections_requested" && <div className="mb-4"><Alert tone="warning" title="A reviewer requested corrections">{t.feedback.filter((f) => !f.resolved).length} unresolved comment(s) below. Fix them in the editor and resubmit.</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card><CardHeader title="Instructions" /><div className="khmer whitespace-pre-wrap p-5 text-sm leading-relaxed">{project?.instructions}</div></Card>
          <Card><CardHeader title="Reviewer feedback" />{t.feedback.length === 0 ? <EmptyState icon={MessageSquare} title="No feedback yet" description="Reviewer comments appear here after review." /> : (
            <ul className="divide-y divide-line">{t.feedback.map((f) => <li key={f.id} className="p-5 text-sm"><div className="mb-1 flex items-center justify-between text-xs text-muted"><span className="font-medium text-fg">{f.author}{f.region ? ` · line ${f.region}` : ""}</span><span>{f.at}</span></div><p className="khmer">{f.text}</p></li>)}</ul>)}</Card>
        </div>
        <div className="space-y-6">
          <Card><CardHeader title="Task info" /><dl className="divide-y divide-line text-sm">{[["Type", project?.type], ["Source file", t.file], ["Pages", `${t.pages}`], ["Reward", usd(t.reward)], ["Attempt", `${t.attempts}`], ["Progress", `${t.completion}%`]].map(([k, v]) => <div key={k} className="flex justify-between px-5 py-2.5"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}<div className="flex justify-between px-5 py-2.5"><dt className="text-muted">Deadline</dt><dd><Deadline iso={t.deadline} done={t.status === "approved"} /></dd></div></dl></Card>
          <Card><CardHeader title="Status history" /><ol className="space-y-3 p-5">{history.map((h, i) => <li key={i} className="flex items-start gap-3 text-sm"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${h.done ? "bg-success" : "bg-line"}`} /><div className={h.done ? "" : "text-muted"}>{h.s}{h.done && <p className="text-xs text-muted">{h.at}</p>}</div></li>)}</ol></Card>
        </div>
      </div>
    </>
  );
}

/* ---------------- Submitted ---------------- */
export function SubmittedTasks() {
  const loading = useFakeLoad(500); const { mine, pname } = useMine();
  const rows = mine.filter((t) => ["submitted", "in_review", "approved"].includes(t.status));
  const cols: Column<AnnTask>[] = [
    { key: "id", header: "Task", sortValue: (t) => t.id, render: (t) => <div><Link href={`/annotate/tasks/${t.id}`} className="font-medium hover:text-brand">{t.id}</Link><p className="text-xs text-muted">{t.file} · p.{t.page}</p></div> },
    { key: "p", header: "Project", render: (t) => pname(t.projectId), hideOnMobile: true },
    { key: "s", header: "Outcome", sortValue: (t) => t.status, render: (t) => <TaskStatusBadge status={t.status} /> },
    { key: "q", header: "Score", sortValue: (t) => t.quality ?? 0, render: (t) => (t.quality ? `${t.quality}%` : "—"), className: "text-right" },
    { key: "r", header: "Reward", sortValue: (t) => t.reward, render: (t) => t.status === "approved" ? <span className="tabular font-medium text-success">+{usd(t.reward)}</span> : <span className="tabular text-muted">{usd(t.reward)} pending</span>, className: "text-right" },
    { key: "u", header: "Updated", sortValue: (t) => t.updated, render: (t) => <span className="text-xs text-muted">{t.updated}</span>, hideOnMobile: true }
  ];
  return (<><PageHeader title="Submitted tasks" description="Tasks waiting for review and tasks that have been approved." />
    <DataTable rows={rows} columns={cols} loading={loading} pageSize={10} searchText={(t) => `${t.id} ${t.file}`} filters={[{ label: "Outcome", options: ["Submitted", "In review", "Approved"], predicate: (t, v) => TASK_STATUS_LABEL[t.status] === v }]} empty={{ title: "Nothing submitted yet", description: "Submit a finished task from the editor and it will show up here." }} /></>);
}

/* ---------------- Feedback ---------------- */
export function AnnotatorFeedback() {
  const loading = useFakeLoad(500); const { mine, pname } = useMine();
  const items = mine.filter((t) => t.status === "corrections_requested" || (t.status === "approved" && t.quality)).sort((a, b) => (a.status === "corrections_requested" ? -1 : 1) - (b.status === "corrections_requested" ? -1 : 1));
  if (loading) return <PageSkeleton />;
  return (
    <>
      <PageHeader title="Feedback" description="Reviewer comments and scores. Corrections come first." />
      {items.length === 0 ? <Card><EmptyState icon={MessageSquare} title="No feedback yet" description="When reviewers score or comment on your work it appears here." /></Card> : (
        <div className="space-y-4">{items.map((t) => (
          <Card key={t.id}><div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5"><div className="min-w-0 flex-1"><p className="font-semibold">{t.id} · {pname(t.projectId)}</p><p className="text-xs text-muted">{t.file} · p.{t.page}</p></div>
            <TaskStatusBadge status={t.status} />{t.quality && <Badge tone={t.quality >= 90 ? "success" : "warning"}>Score {t.quality}%</Badge>}
            {t.status === "corrections_requested" && <Button size="sm" href={`/annotate/tasks/${t.id}/edit`}>Fix in editor</Button>}</div>
            {t.feedback.length ? <ul className="divide-y divide-line">{t.feedback.map((f) => <li key={f.id} className="px-5 py-3 text-sm"><p className="mb-0.5 text-xs text-muted">{f.author} · {f.at}{f.region ? ` · line ${f.region}` : ""}</p><p className="khmer">{f.text}</p></li>)}</ul>
              : <p className="px-5 py-4 text-sm text-muted">Approved with no comments. Great work.</p>}</Card>))}</div>)}
    </>
  );
}

/* ---------------- Earnings ---------------- */
export function AnnotatorEarnings() {
  const loading = useFakeLoad(500); const { mine, pname, projects } = useMine();
  if (loading) return <PageSkeleton />;
  const k = KPIs(mine);
  const byProject = projects.map((p) => { const m = mine.filter((t) => t.projectId === p.id); return { name: p.name.split(" ")[0], Approved: +m.filter((t) => t.status === "approved").reduce((s, t) => s + t.reward, 0).toFixed(2), Pending: +m.filter((t) => ["submitted", "in_review"].includes(t.status)).reduce((s, t) => s + t.reward, 0).toFixed(2) }; }).filter((r) => r.Approved + r.Pending > 0);
  const approved = mine.filter((t) => t.status === "approved");
  return (
    <>
      <PageHeader title="Annotation earnings" description="Rewards are credited to your wallet when a reviewer approves a task." actions={<Button href="/withdrawals" variant="outline"><Banknote size={14} />Withdraw funds</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Approved rewards" value={usd(k.rewards)} icon={CheckCircle2} tone="success" hint={`${k.approved} tasks`} /><Stat label="Pending review" value={usd(k.pending)} icon={Send} tone="warning" />
        <Stat label="Estimated (open tasks)" value={usd(k.est)} icon={Clock} /><Stat label="Average per task" value={usd(k.approved ? k.rewards / k.approved : 0)} icon={Banknote} />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2"><CardHeader title="By project" />{byProject.length ? <div className="p-4"><Bars data={byProject} x="name" series={["Approved", "Pending"]} stacked /></div> : <EmptyState title="No rewards yet" />}</Card>
        <Card className="lg:col-span-3"><CardHeader title="Approved tasks" />
          {approved.length === 0 ? <EmptyState title="No approved tasks" description="Approved tasks and their rewards are listed here." /> : <ul className="divide-y divide-line">{approved.map((t) => <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><div><Link href={`/annotate/tasks/${t.id}`} className="font-medium hover:text-brand">{t.id}</Link><p className="text-xs text-muted">{pname(t.projectId)} · {t.updated}</p></div><span className="tabular font-medium text-success">+{usd(t.reward)}</span></li>)}</ul>}</Card>
      </div>
    </>
  );
}
