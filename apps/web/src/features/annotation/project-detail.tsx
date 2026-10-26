"use client";
import { ArrowRight, CheckCircle2, Gauge, ListChecks, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bars, AreaTrend, Donut } from "@/components/ui/charts";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tabs, useUI } from "@/components/ui/overlays";
import { Alert, Avatar, Card, CardHeader, EmptyState, ErrorState, Field, Input, PageHeader, Progress, Skeleton, Stat, Textarea } from "@/components/ui/primitives";
import { usd } from "@/lib/cn";
import { useFakeLoad, wait } from "@/lib/demo";
import { TASK_STATUSES, TASK_STATUS_LABEL, TODAY, projectProgress, type AnnTask, type Project } from "./data";
import { projectMenu, useProjectActions } from "./admin-projects";
import { Deadline, ProjectStatusBadge, TaskStatusBadge, useQueryState } from "./shared";
import { useProjects, useTasks } from "./store";
import { Menu } from "@/components/ui/overlays";

const TABS = ["overview", "tasks", "settings"] as const;
type Tab = (typeof TABS)[number];

export function ProjectDetail({ id }: { id: string }) {
  const loading = useFakeLoad(500);
  const { projects, patchProject } = useProjects();
  const { tasks } = useTasks();
  const [tab, setTab] = useQueryState<Tab>("tab", "overview", TABS);
  const act = useProjectActions();
  const project = projects.find((p) => p.id === id);
  const mine = useMemo(() => tasks.filter((t) => t.projectId === id), [tasks, id]);
  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><div className="grid grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-72" /></div>;
  if (!project) return <Card><ErrorState title="Project not found" description={`There is no annotation project with ID ${id}.`} /><div className="pb-8 text-center"><Button href="/admin/annotation/projects" variant="outline">Back to projects</Button></div></Card>;
  const pr = projectProgress(mine.length ? tasks : [], id);
  return (
    <>
      <PageHeader title={project.name} breadcrumbs={[{ label: "Annotation projects", href: "/admin/annotation/projects" }, { label: project.id }]}
        description={`${project.type} · ${project.dataset} · created ${project.created}`}
        actions={<><ProjectStatusBadge status={project.status} /><Button variant="outline" href={`/admin/annotation/assignments?project=${id}`}><ListChecks size={14} />Assign tasks</Button><Menu label="Project actions" items={projectMenu(project, act)} trigger={<span className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface2">Actions ▾</span>} /></>} />
      {project.status === "paused" && <div className="mb-4"><Alert tone="warning" title="This project is paused" action={<Button size="sm" variant="outline" onClick={() => void act.pause(project)}>Resume</Button>}>Annotators cannot start new tasks until it is resumed.</Alert></div>}
      {project.status === "closed" && <div className="mb-4"><Alert tone="info" title="This project is closed">No new work is accepted. Submitted tasks can still be reviewed.</Alert></div>}
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "overview", label: "Overview" }, { id: "tasks", label: "Tasks", count: mine.length }, { id: "settings", label: "Settings" }]} />
      <div className="pt-6">
        {tab === "overview" && <Overview project={project} tasks={mine} pr={pr} />}
        {tab === "tasks" && <TasksTab tasks={mine} project={project} />}
        {tab === "settings" && <Settings key={project.id} project={project} onSave={patchProject} act={act} />}
      </div>
    </>
  );
}

function seriesFor(id: string) {
  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: 14 }, (_, i) => ({ day: `Oct ${13 + i}`, Submitted: 6 + ((seed * (i + 3)) % 11), Approved: 4 + ((seed * (i + 5)) % 9) }));
}

function Overview({ project, tasks, pr }: { project: Project; tasks: AnnTask[]; pr: ReturnType<typeof projectProgress> }) {
  const paid = tasks.filter((t) => t.status === "approved").reduce((s, t) => s + t.reward, 0);
  const pending = tasks.filter((t) => ["submitted", "in_review"].includes(t.status)).reduce((s, t) => s + t.reward, 0);
  const budget = tasks.length * project.reward;
  const workers = project.annotators.map((n) => {
    const mine = tasks.filter((t) => t.assignee === n);
    const c = (s: string) => mine.filter((t) => t.status === s).length;
    return { name: n, total: mine.length, assigned: c("assigned"), progress: c("in_progress"), submitted: c("submitted") + c("in_review"), approved: c("approved"), corrections: c("corrections_requested") };
  });
  const donut = pr.byStatus.filter((s) => s.value > 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Progress" value={`${pr.pct}%`} icon={Gauge} hint={`${pr.done} of ${pr.total} tasks approved`} />
        <Stat label="Quality score" value={project.quality ? `${project.quality}%` : "—"} icon={CheckCircle2} tone="success" hint="Average reviewer score" />
        <Stat label="Deadline" value={<Deadline iso={project.deadline} done={project.status === "closed"} />} icon={ListChecks} tone="warning" hint={`${project.annotators.length} annotators`} />
        <Stat label="Reward budget" value={usd(budget)} icon={Wallet} hint={`${usd(project.reward)} per ${project.unit} task`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader title="Daily throughput" description="Tasks submitted and approved, last 14 days" />
          <div className="p-4"><AreaTrend data={seriesFor(project.id)} x="day" series={["Submitted", "Approved"]} /></div></Card>
        <Card><CardHeader title="Tasks by status" />
          <div className="p-4">{donut.length ? <Donut data={donut} /> : <EmptyState title="No tasks yet" />}</div></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Worker productivity" description="Approved tasks per annotator" />
          <div className="p-4">{workers.length ? <Bars data={workers.map((w) => ({ name: w.name.split(" ")[0], Approved: w.approved, Submitted: w.submitted, "In progress": w.progress }))} x="name" series={["Approved", "Submitted", "In progress"]} stacked /> : <EmptyState title="No annotators" />}</div></Card>
        <Card><CardHeader title="Reward budget" description="Maximum reward budget for this project" />
          <div className="space-y-4 p-5">
            <div><div className="mb-1.5 flex justify-between text-sm"><span>Paid on approval</span><span className="tabular font-medium">{usd(paid)}</span></div><Progress value={budget ? (paid / budget) * 100 : 0} tone="success" label="Paid" /></div>
            <div><div className="mb-1.5 flex justify-between text-sm"><span>Pending review</span><span className="tabular font-medium">{usd(pending)}</span></div><Progress value={budget ? (pending / budget) * 100 : 0} tone="warning" label="Pending" /></div>
            <div className="flex justify-between border-t border-line pt-3 text-sm"><span className="text-muted">Remaining</span><span className="tabular font-semibold">{usd(Math.max(0, budget - paid - pending))}</span></div>
          </div></Card>
      </div>
      <Card><CardHeader title="Assignments" description="Workload per annotator" action={<Button href={`/admin/annotation/assignments?project=${project.id}`} variant="outline" size="sm">Manage<ArrowRight size={13} /></Button>} />
        <div className="scroll-thin overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-surface2/60 text-xs text-muted"><tr>{["Annotator", "Total", "Assigned", "In progress", "Submitted", "Corrections", "Approved"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{workers.map((w) => <tr key={w.name}><td className="px-4 py-3"><span className="flex items-center gap-2"><Avatar name={w.name} size={24} />{w.name}</span></td>{[w.total, w.assigned, w.progress, w.submitted, w.corrections, w.approved].map((n, i) => <td key={i} className="tabular px-4 py-3">{n}</td>)}</tr>)}</tbody></table></div></Card>
      <Card><CardHeader title="Instructions" /><div className="khmer whitespace-pre-wrap p-5 text-sm leading-relaxed">{project.instructions}</div></Card>
    </div>
  );
}

function TasksTab({ tasks, project }: { tasks: AnnTask[]; project: Project }) {
  const cols: Column<AnnTask>[] = [
    { key: "id", header: "Task", sortValue: (t) => t.id, render: (t) => <span className="font-medium">{t.id}</span> },
    { key: "file", header: "Source", sortValue: (t) => t.file, render: (t) => <span>{t.file} <span className="text-muted">· p.{t.page}</span></span> },
    { key: "assignee", header: "Assignee", sortValue: (t) => t.assignee ?? "", render: (t) => t.assignee ?? <span className="text-muted">Unassigned</span> },
    { key: "status", header: "Status", sortValue: (t) => t.status, render: (t) => <TaskStatusBadge status={t.status} /> },
    { key: "deadline", header: "Deadline", sortValue: (t) => t.deadline, render: (t) => <Deadline iso={t.deadline} done={t.status === "approved"} /> },
    { key: "q", header: "Quality", sortValue: (t) => t.quality ?? 0, render: (t) => (t.quality ? `${t.quality}%` : "—"), className: "text-right" }
  ];
  return <DataTable rows={tasks} columns={cols} pageSize={10} searchText={(t) => `${t.id} ${t.file} ${t.assignee ?? ""}`}
    filters={[{ label: "Status", options: TASK_STATUSES.map((s) => TASK_STATUS_LABEL[s]), predicate: (t, v) => TASK_STATUS_LABEL[t.status] === v }]}
    toolbar={<Button href={`/admin/annotation/assignments?project=${project.id}`} size="sm" variant="outline">Assign tasks</Button>}
    empty={{ title: "No tasks generated", description: "Tasks appear here once the project dataset has been split." }} />;
}

function Settings({ project, onSave, act }: { project: Project; onSave: (id: string, p: Partial<Project>) => void; act: ReturnType<typeof useProjectActions> }) {
  const { toast } = useUI();
  const [f, setF] = useState({ name: project.name, deadline: project.deadline, reward: String(project.reward), instructions: project.instructions });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => setF({ name: project.name, deadline: project.deadline, reward: String(project.reward), instructions: project.instructions }), [project]);
  const dirty = f.name !== project.name || f.deadline !== project.deadline || Number(f.reward) !== project.reward || f.instructions !== project.instructions;
  const save = async () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 3) e.name = "Name must be at least 3 characters.";
    if (!(Number(f.reward) >= 0.05 && Number(f.reward) <= 5)) e.reward = "Reward must be between $0.05 and $5.00.";
    if (!f.deadline || f.deadline <= TODAY) e.deadline = "Deadline must be in the future.";
    if (f.instructions.trim().length < 20) e.instructions = "Instructions need at least 20 characters.";
    setErr(e); if (Object.keys(e).length) return;
    setSaving(true); await wait(600); onSave(project.id, { name: f.name.trim(), deadline: f.deadline, reward: Number(f.reward), instructions: f.instructions }); setSaving(false); toast("Project settings saved.");
  };
  const closed = project.status === "closed";
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardHeader title="Project settings" description="Reward changes apply only to tasks that are not yet assigned." />
        <div className="space-y-4 p-5">
          <Field label="Project name" required error={err.name}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!err.name} disabled={closed} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reward per task (USD)" required error={err.reward}>{(id, d) => <Input id={id} type="number" step="0.05" aria-describedby={d} aria-invalid={!!err.reward} disabled={closed} value={f.reward} onChange={(e) => setF({ ...f, reward: e.target.value })} />}</Field>
            <Field label="Deadline" required error={err.deadline}>{(id, d) => <Input id={id} type="date" aria-describedby={d} aria-invalid={!!err.deadline} disabled={closed} value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />}</Field>
          </div>
          <Field label="Instructions" required error={err.instructions}>{(id, d) => <Textarea id={id} rows={8} className="khmer" aria-describedby={d} aria-invalid={!!err.instructions} disabled={closed} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />}</Field>
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={!dirty} onClick={() => { setF({ name: project.name, deadline: project.deadline, reward: String(project.reward), instructions: project.instructions }); setErr({}); }}>Discard</Button><Button loading={saving} disabled={!dirty || closed} onClick={() => void save()}>Save changes</Button></div>
        </div></Card>
      <Card><CardHeader title="Danger zone" />
        <div className="space-y-3 p-5 text-sm">
          <p className="text-muted">Pausing stops new task starts. Closing is permanent.</p>
          <Button variant="outline" className="w-full" disabled={closed} onClick={() => void act.pause(project)}>{project.status === "paused" ? "Resume project" : "Pause project"}</Button>
          <Button variant="danger" className="w-full" disabled={closed} onClick={() => void act.close(project)}>Close project</Button>
          <Link href={`/admin/annotation/assignments?project=${project.id}`} className="block text-center text-brand hover:underline">Open assignments</Link>
        </div></Card>
    </div>
  );
}
