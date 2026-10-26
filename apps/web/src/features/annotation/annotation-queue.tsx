"use client";
import { Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tabs, useUI } from "@/components/ui/overlays";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { useFakeLoad, wait } from "@/lib/demo";
import { REVIEWER, TODAY, daysLeft, type AnnTask } from "./data";
import { Deadline, TaskStatusBadge, useQueryState } from "./shared";
import { useProjects, useTasks } from "./store";

const TABS = ["queue", "mine"] as const;
type Tab = (typeof TABS)[number];

/** Annotation review queue. `admin` = cross-project queue under /admin/annotation/reviews. */
/** Claim flow shared by the queue and the reviewer dashboard. */
export function useClaimTask(who: string) {
  const { patchTasks } = useTasks(); const { toast, confirm } = useUI(); const router = useRouter();
  return async (t: AnnTask) => {
    if (t.assignee === who) { toast("You cannot review your own work.", "error"); return; }
    if (!(await confirm({ title: `Claim ${t.id}?`, description: `You will be the only reviewer for this task until you decide or release it. Annotator: ${t.assignee}.`, confirmLabel: "Claim and open" }))) return;
    await wait(350); patchTasks([t.id], { status: "in_review", reviewer: who }); toast(`${t.id} claimed.`);
    router.push(`/review/annotations/${t.id}`);
  };
}

export function AnnotationQueue({ admin }: { admin?: boolean }) {
  const loading = useFakeLoad(500);
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const [tab, setTab] = useQueryState<Tab>("tab", "queue", TABS);
  const who = admin ? "Anna Keller" : REVIEWER;
  const queue = useMemo(() => tasks.filter((t) => t.status === "submitted"), [tasks]);
  const mine = useMemo(() => tasks.filter((t) => t.status === "in_review" && (admin || t.reviewer === REVIEWER)), [tasks, admin]);
  const rows = admin || tab === "queue" ? (admin ? tasks.filter((t) => t.status === "submitted" || t.status === "in_review") : queue) : mine;
  const pname = (id: string) => projects.find((p) => p.id === id)?.name ?? id;
  const base = "/review/annotations";

  const claim = useClaimTask(who);
  const cols: Column<AnnTask>[] = [
    { key: "id", header: "Task", sortValue: (t) => t.id, render: (t) => <span className="font-medium">{t.id}</span> },
    { key: "p", header: "Project / source", sortValue: (t) => t.projectId, render: (t) => <div>{pname(t.projectId)}<p className="text-xs text-muted">{t.file} · p.{t.page}</p></div> },
    { key: "a", header: "Annotator", sortValue: (t) => t.assignee ?? "", render: (t) => t.assignee },
    { key: "s", header: admin ? "Status / reviewer" : "Attempt", render: (t) => admin ? <div className="flex flex-col gap-1"><TaskStatusBadge status={t.status} /><span className="text-xs text-muted">{t.reviewer ?? "Unclaimed"}</span></div> : t.attempts > 1 ? <Badge tone="warning">{t.attempts}nd attempt ↻</Badge> : <Badge>1st</Badge> },
    { key: "u", header: "Submitted", sortValue: (t) => t.updated, render: (t) => <span className="text-xs text-muted">{t.updated} · <span className={daysLeft(t.updated) < -3 ? "text-warning" : ""}>{Math.max(0, -daysLeft(t.updated))}d ago</span></span> },
    { key: "d", header: "Due", render: (t) => <Deadline iso={t.deadline} /> , hideOnMobile: true },
    { key: "act", header: "", className: "w-28 text-right", render: (t) => t.status === "in_review" ? <Button size="sm" variant="outline" href={`${base}/${t.id}`}>Continue</Button> : <Button size="sm" onClick={() => void claim(t)}>Claim</Button> }
  ];
  return (
    <>
      <PageHeader title={admin ? "Annotation review queue" : "Annotation reviews"} description={admin ? "Submitted tasks awaiting review across all projects." : "Claim submitted tasks, compare versions and decide. Your own work is never claimable."} breadcrumbs={admin ? [{ label: "Annotation" }, { label: "Reviews" }] : undefined} />
      {!admin && <div className="mb-4"><Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "queue", label: "Queue", count: queue.length }, { id: "mine", label: "Mine", count: mine.length }]} /></div>}
      <DataTable key={tab} rows={rows} columns={cols} loading={loading} pageSize={10} searchText={(t) => `${t.id} ${t.file} ${t.assignee} ${pname(t.projectId)}`}
        filters={[{ label: "Project", options: projects.map((p) => p.name), predicate: (t, v) => pname(t.projectId) === v }, { label: "Annotator", options: [...new Set(tasks.map((t) => t.assignee).filter(Boolean) as string[])], predicate: (t, v) => t.assignee === v }]}
        empty={{ title: tab === "mine" && !admin ? "No claimed reviews" : "Queue is clear", description: tab === "mine" && !admin ? "Claim a task from the queue to start reviewing." : "New submissions will appear here." }} />
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Inbox size={13} />As of {TODAY}. Resubmitted tasks (2nd attempt) open with the previous version preselected.</p>
    </>
  );
}
