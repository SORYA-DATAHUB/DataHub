"use client";
import { UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Menu, Modal, useUI } from "@/components/ui/overlays";
import { Alert, Avatar, PageHeader, Progress, Select } from "@/components/ui/primitives";
import { useFakeLoad, wait } from "@/lib/demo";
import { ANNOTATORS, TASK_STATUSES, TASK_STATUS_LABEL, TODAY, type AnnTask, type TaskStatus } from "./data";
import { Deadline, TaskStatusBadge, useQueryState } from "./shared";
import { useProjects, useTasks } from "./store";

export function AdminAssignments() {
  const loading = useFakeLoad(500);
  const { projects } = useProjects();
  const { tasks, patchTasks } = useTasks();
  const { toast, confirm } = useUI();
  const ids = ["all", ...projects.map((p) => p.id)];
  const [projectQ, setProjectQ] = useQueryState<string>("project", "all", ids);
  const statuses = ["all", ...TASK_STATUSES] as const;
  const [statusQ, setStatusQ] = useQueryState<"all" | TaskStatus>("status", "all", statuses);
  const [sel, setSel] = useState<string[]>([]);
  const [dlg, setDlg] = useState<{ ids: string[]; mode: "assign" | "reassign" } | null>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState(0);

  const rows = useMemo(() => tasks.filter((t) => (projectQ === "all" || t.projectId === projectQ) && (statusQ === "all" || t.status === statusQ)), [tasks, projectQ, statusQ]);
  const pname = (id: string) => projects.find((p) => p.id === id)?.name ?? id;
  const load = (name: string) => tasks.filter((t) => t.assignee === name && ["assigned", "in_progress", "corrections_requested"].includes(t.status)).length;
  const eligible = (ids: string[]) => { const pids = new Set(tasks.filter((t) => ids.includes(t.id)).map((t) => t.projectId)); return ANNOTATORS.filter((a) => [...pids].every((p) => projects.find((x) => x.id === p)?.annotators.includes(a.name))); };

  const open = (ids: string[], mode: "assign" | "reassign") => { setTarget(""); setDlg({ ids, mode }); };
  const apply = async () => {
    if (!dlg || !target) return;
    setBusy(true); await wait(600);
    patchTasks(dlg.ids, { assignee: target, status: "assigned", updated: TODAY });
    setBusy(false); toast(`${dlg.ids.length} task${dlg.ids.length > 1 ? "s" : ""} ${dlg.mode === "assign" ? "assigned" : "reassigned"} to ${target}.`); setDlg(null); setSel([]); setGen((g) => g + 1);
  };
  const unassign = async (t: AnnTask) => {
    if (!(await confirm({ title: `Unassign ${t.id}?`, description: `${t.assignee} loses access to this task. Any unsaved draft is kept for the next annotator.`, confirmLabel: "Unassign", danger: true }))) return;
    patchTasks([t.id], { assignee: null, status: "unassigned" }); toast(`${t.id} unassigned.`);
  };

  const cols: Column<AnnTask>[] = [
    { key: "id", header: "Task", sortValue: (t) => t.id, render: (t) => <div><span className="font-medium">{t.id}</span><p className="text-xs text-muted">{t.file} · p.{t.page}</p></div> },
    { key: "project", header: "Project", sortValue: (t) => t.projectId, render: (t) => pname(t.projectId), hideOnMobile: true },
    { key: "assignee", header: "Assignee", sortValue: (t) => t.assignee ?? "", render: (t) => t.assignee ? <span className="flex items-center gap-2"><Avatar name={t.assignee} size={22} />{t.assignee}</span> : <span className="text-muted">Unassigned</span> },
    { key: "status", header: "Status", sortValue: (t) => t.status, render: (t) => <TaskStatusBadge status={t.status} /> },
    { key: "deadline", header: "Deadline", sortValue: (t) => t.deadline, render: (t) => <Deadline iso={t.deadline} done={t.status === "approved"} /> },
    { key: "act", header: "", className: "w-10", render: (t) => {
      const locked = ["submitted", "in_review", "approved"].includes(t.status);
      return <Menu label={`Actions for ${t.id}`} items={[
        t.assignee ? { label: "Reassign…", onClick: () => open([t.id], "reassign"), disabled: locked } : { label: "Assign…", onClick: () => open([t.id], "assign") },
        { label: "Unassign", onClick: () => void unassign(t), danger: true, disabled: !t.assignee || locked }
      ]} />;
    } }
  ];
  const candidates = dlg ? eligible(dlg.ids) : [];
  const dlgTasks = dlg ? tasks.filter((t) => dlg.ids.includes(t.id)) : [];
  const locked = dlgTasks.filter((t) => ["submitted", "in_review", "approved"].includes(t.status));

  return (
    <>
      <PageHeader title="Annotation assignments" description="Assign, reassign and rebalance tasks across annotators." breadcrumbs={[{ label: "Annotation" }, { label: "Assignments" }]}
        actions={<Button disabled={sel.length === 0} onClick={() => open(sel, "assign")}><UserPlus size={14} />Bulk assign{sel.length ? ` (${sel.length})` : ""}</Button>} />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_320px]">
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Project" className="w-auto" value={projectQ} onChange={(e) => { setProjectQ(e.target.value); setSel([]); }}><option value="all">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          <Select aria-label="Status" className="w-auto" value={statusQ} onChange={(e) => { setStatusQ(e.target.value as "all" | TaskStatus); setSel([]); }}><option value="all">All statuses</option>{TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}</Select>
        </div>
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ANNOTATORS.map((a) => { const l = load(a.name); const pct = Math.round((l / a.capacity) * 100); return (
          <div key={a.name} className="rounded-lg border border-line bg-surface p-3"><div className="mb-1.5 flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium"><Avatar name={a.name} size={22} />{a.name}</span><span className="tabular text-xs text-muted">{l}/{a.capacity}</span></div>
            <Progress value={pct} tone={pct >= 100 ? "danger" : pct >= 80 ? "warning" : "brand"} label={`${a.name} workload`} /></div>); })}
      </div>
      <DataTable key={`${projectQ}-${statusQ}-${gen}`} rows={rows} columns={cols} loading={loading} selectable onSelectionChange={setSel} searchText={(t) => `${t.id} ${t.file} ${t.assignee ?? ""}`} pageSize={10}
        filters={[{ label: "Assignee", options: ["Unassigned", ...ANNOTATORS.map((a) => a.name)], predicate: (t, v) => (v === "Unassigned" ? !t.assignee : t.assignee === v) }]}
        toolbar={sel.length ? <><Button size="sm" variant="outline" onClick={() => open(sel, "reassign")}><Users size={13} />Reassign</Button></> : undefined}
        empty={{ title: "No tasks match these filters", description: "Change the project or status filter to see tasks." }} />

      <Modal open={!!dlg} onClose={() => setDlg(null)} title={dlg ? `${dlg.mode === "assign" ? "Assign" : "Reassign"} ${dlg.ids.length} task${dlg.ids.length > 1 ? "s" : ""}` : ""} description="Choose an annotator who is enrolled in the project."
        footer={<><Button variant="outline" onClick={() => setDlg(null)}>Cancel</Button><Button loading={busy} disabled={!target || locked.length === dlg?.ids.length} onClick={() => void apply()}>{dlg?.mode === "assign" ? "Assign" : "Reassign"}</Button></>}>
        <div className="space-y-3">
          {locked.length > 0 && <Alert tone="warning" title={`${locked.length} task${locked.length > 1 ? "s are" : " is"} already submitted or approved`}>They will be reset to “Assigned”. Consider leaving them untouched.</Alert>}
          {candidates.length === 0 ? <Alert tone="danger" title="No common annotator">The selected tasks belong to projects with no shared annotators. Narrow the selection to one project.</Alert> : (
            <fieldset className="space-y-1.5"><legend className="sr-only">Annotator</legend>{candidates.map((a) => { const l = load(a.name); const full = l + (dlg?.ids.length ?? 0) > a.capacity; return (
              <label key={a.name} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${target === a.name ? "border-brand bg-brand-soft" : "border-line hover:bg-surface2"}`}>
                <input type="radio" name="annotator" checked={target === a.name} onChange={() => setTarget(a.name)} /><Avatar name={a.name} size={26} />
                <span className="flex-1 text-sm"><span className="font-medium">{a.name}</span><span className="block text-xs text-muted">{a.accuracy}% accuracy · {l}/{a.capacity} active</span></span>
                {full && <span className="text-xs text-warning">Over capacity</span>}</label>); })}</fieldset>)}
        </div>
      </Modal>
    </>
  );
}
