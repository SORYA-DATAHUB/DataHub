"use client";
import { FolderKanban, Gauge, Plus, Users, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Menu, useUI } from "@/components/ui/overlays";
import { PageHeader, Stat } from "@/components/ui/primitives";
import { useFakeLoad, wait } from "@/lib/demo";
import { usd } from "@/lib/cn";
import { projectProgress, type Project } from "./data";
import { Deadline, ProgressCell, ProjectStatusBadge } from "./shared";
import { useProjects, useTasks } from "./store";

type Row = Project & { pct: number; total: number; done: number; budget: number };

/** Shared project actions (list + detail). */
export function useProjectActions() {
  const { patchProject } = useProjects();
  const { confirm, toast } = useUI();
  const router = useRouter();
  return {
    view: (p: Project) => router.push(`/admin/annotation/projects/${p.id}`),
    assign: (p: Project) => router.push(`/admin/annotation/assignments?project=${p.id}`),
    async pause(p: Project) {
      const resume = p.status === "paused";
      if (!(await confirm({ title: resume ? `Resume ${p.name}?` : `Pause ${p.name}?`, description: resume ? "Annotators can continue working on their tasks." : "Annotators can finish drafts but cannot start new tasks until you resume the project.", confirmLabel: resume ? "Resume project" : "Pause project" }))) return;
      await wait(400); patchProject(p.id, { status: resume ? "active" : "paused" }); toast(resume ? "Project resumed." : "Project paused.");
    },
    async close(p: Project) {
      if (!(await confirm({ title: `Close ${p.name}?`, description: "Closing is permanent: unassigned tasks are cancelled and no new work is accepted. Submitted tasks can still be reviewed.", confirmLabel: "Close project", danger: true }))) return;
      await wait(400); patchProject(p.id, { status: "closed" }); toast("Project closed.");
    }
  };
}
export function projectMenu(p: Project, a: ReturnType<typeof useProjectActions>) {
  return [
    { label: "View project", onClick: () => a.view(p) }, { label: "Assign annotators", onClick: () => a.assign(p), disabled: p.status === "closed" },
    "sep" as const, { label: p.status === "paused" ? "Resume project" : "Pause project", onClick: () => void a.pause(p), disabled: p.status === "closed" || p.status === "draft" },
    { label: "Close project", onClick: () => void a.close(p), danger: true, disabled: p.status === "closed" }
  ];
}

export function AdminProjects() {
  const loading = useFakeLoad(500);
  const { projects } = useProjects();
  const { tasks } = useTasks();
  const act = useProjectActions();
  const rows: Row[] = useMemo(() => projects.map((p) => { const pr = projectProgress(tasks, p.id); const total = pr.total; return { ...p, pct: pr.pct, total, done: pr.done, budget: total * p.reward }; }), [projects, tasks]);
  const cols: Column<Row>[] = [
    { key: "name", header: "Project", sortValue: (r) => r.name, render: (r) => <div><button className="text-left font-medium hover:text-brand" onClick={() => act.view(r)}>{r.name}</button><p className="text-xs text-muted">{r.id} · {r.dataset}</p></div> },
    { key: "type", header: "Type", sortValue: (r) => r.type, render: (r) => r.type, hideOnMobile: true },
    { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => <ProjectStatusBadge status={r.status} /> },
    { key: "progress", header: "Progress", sortValue: (r) => r.pct, render: (r) => <ProgressCell value={r.pct} label={`${r.done}/${r.total}`} /> },
    { key: "deadline", header: "Deadline", sortValue: (r) => r.deadline, render: (r) => <Deadline iso={r.deadline} done={r.status === "closed"} /> },
    { key: "quality", header: "Quality", sortValue: (r) => r.quality, render: (r) => <span className="tabular">{r.quality}%</span>, className: "text-right" },
    { key: "budget", header: "Budget", sortValue: (r) => r.budget, render: (r) => <span className="tabular">{usd(r.budget)}</span>, className: "text-right" },
    { key: "act", header: "", render: (r) => <Menu label={`Actions for ${r.name}`} items={projectMenu(r, act)} />, className: "w-10" }
  ];
  const active = projects.filter((p) => p.status === "active").length;
  const all = tasks.length; const approved = tasks.filter((t) => t.status === "approved").length;
  return (
    <>
      <PageHeader title="Annotation projects" description="Create, monitor and manage annotation projects built from approved datasets."
        actions={<Button href="/admin/annotation/projects/new"><Plus size={15} />New project</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active projects" value={active} icon={FolderKanban} hint={`${projects.length} total`} />
        <Stat label="Tasks approved" value={`${approved}/${all}`} icon={Gauge} tone="success" hint={`${all ? Math.round((approved / all) * 100) : 0}% complete`} />
        <Stat label="Annotators working" value={new Set(tasks.filter((t) => t.status === "in_progress").map((t) => t.assignee)).size} icon={Users} tone="warning" hint="With tasks in progress" />
        <Stat label="Reward budget" value={usd(rows.reduce((s, r) => s + r.budget, 0))} icon={Wallet} hint="Across all projects" />
      </div>
      <DataTable rows={rows} columns={cols} loading={loading} searchText={(r) => `${r.name} ${r.id} ${r.dataset}`} pageSize={8}
        filters={[{ label: "Status", options: ["active", "paused", "closed", "draft"], predicate: (r, v) => r.status === v }, { label: "Type", options: ["Transcription", "Text correction", "Page classification", "Metadata tagging"], predicate: (r, v) => r.type === v }]}
        empty={{ title: "No annotation projects", description: "Create a project from an approved dataset to start generating tasks." }} />
    </>
  );
}
