"use client";
import { ArrowRight, BookOpenCheck, CheckCircle2, ClipboardCheck, Tags } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Drawer, Tabs, useUI } from "@/components/ui/overlays";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Skeleton, StatusBadge, Stat } from "@/components/ui/primitives";
import { usd, gb } from "@/lib/cn";
import { useFakeLoad, wait } from "@/lib/demo";
import { DATASET_REVIEWS, REVIEWER, TODAY, daysLeft, type DatasetReview, type ReviewRecord } from "./data";
import { useClaimTask } from "./annotation-queue";
import { useQueryState } from "./shared";
import { useClaims, useReviewHistory, useTasks } from "./store";

const age = (iso: string) => Math.max(0, -daysLeft(iso));
const AgeBadge = ({ iso }: { iso: string }) => { const d = age(iso); return <Badge tone={d >= 5 ? "danger" : d >= 3 ? "warning" : "neutral"}>{d === 0 ? "today" : `${d} day${d > 1 ? "s" : ""}`}</Badge>; };

function useDatasetClaims() {
  const [claims, setClaims] = useClaims("dataset");
  const { toast, confirm } = useUI();
  const claim = async (r: DatasetReview) => {
    if (r.owner === REVIEWER) { toast("You cannot review your own dataset.", "error"); return false; }
    if (!(await confirm({ title: `Claim “${r.title}”?`, description: "You become the only reviewer until you finalize or release it.", confirmLabel: "Claim review" }))) return false;
    await wait(350); setClaims((c) => ({ ...c, [r.id]: REVIEWER })); toast(`${r.id} claimed.`); return true;
  };
  return { claims, claim };
}

/* ---------------- Dashboard ---------------- */
export function ReviewDashboard() {
  const loading = useFakeLoad(500);
  const { tasks } = useTasks(); const { claims, claim } = useDatasetClaims(); const { history } = useReviewHistory();
  const claimTask = useClaimTask(REVIEWER); const router = useRouter();
  if (loading) return <div className="space-y-4"><Skeleton className="h-9 w-48" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>;
  const dsQueue = DATASET_REVIEWS.filter((r) => !claims[r.id]); const dsMine = DATASET_REVIEWS.filter((r) => claims[r.id] === REVIEWER);
  const anQueue = tasks.filter((t) => t.status === "submitted"); const anMine = tasks.filter((t) => t.status === "in_review" && t.reviewer === REVIEWER);
  return (
    <>
      <PageHeader title="Review" description="Your claimed reviews and the oldest items waiting in the queues." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Datasets awaiting" value={dsQueue.length} icon={BookOpenCheck} /><Stat label="My dataset reviews" value={dsMine.length} icon={ClipboardCheck} tone="warning" />
        <Stat label="Annotations awaiting" value={anQueue.length} icon={Tags} /><Stat label="My annotation reviews" value={anMine.length} icon={ClipboardCheck} tone="warning" />
        <Stat label="Reviewed this week" value={history.length} icon={CheckCircle2} tone="success" hint={`${history.filter((h) => h.kind === "dataset").length} datasets · ${history.filter((h) => h.kind === "annotation").length} annotations`} />
      </div>
      <Card className="mb-6"><CardHeader title="My in-progress reviews" />
        {dsMine.length + anMine.length === 0 ? <EmptyState icon={CheckCircle2} title="Nothing in progress" description="Claim an item from the queues below." /> : (
          <ul className="divide-y divide-line">
            {dsMine.map((r) => <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm"><Badge tone="brand">Dataset</Badge><span className="min-w-0 flex-1 truncate font-medium">{r.title}</span><span className="hidden text-xs text-muted sm:inline">{r.files} files</span><Button size="sm" variant="outline" href={`/review/datasets/${r.id}`}>Continue<ArrowRight size={13} /></Button></li>)}
            {anMine.map((t) => <li key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm"><Badge tone="success">Annotation</Badge><span className="min-w-0 flex-1 truncate font-medium">{t.id} · {t.file} p.{t.page}</span><span className="hidden text-xs text-muted sm:inline">{t.assignee}</span><Button size="sm" variant="outline" href={`/review/annotations/${t.id}`}>Continue<ArrowRight size={13} /></Button></li>)}
          </ul>)}</Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Oldest datasets in queue" action={<Button href="/review/datasets" variant="ghost" size="sm">View all</Button>} />
          {dsQueue.length === 0 ? <EmptyState title="Queue is clear" /> : <ul className="divide-y divide-line">{[...dsQueue].sort((a, b) => a.submitted.localeCompare(b.submitted)).slice(0, 4).map((r) => <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm"><div className="min-w-0 flex-1"><p className="truncate font-medium">{r.title}</p><p className="text-xs text-muted">{gb(r.sizeGb)} · {r.files} files</p></div><AgeBadge iso={r.submitted} />
            <Button size="sm" disabled={r.owner === REVIEWER} onClick={async () => { if (await claim(r)) router.push(`/review/datasets/${r.id}`); }}>{r.owner === REVIEWER ? "Yours" : "Claim"}</Button></li>)}</ul>}</Card>
        <Card><CardHeader title="Oldest annotations in queue" action={<Button href="/review/annotations" variant="ghost" size="sm">View all</Button>} />
          {anQueue.length === 0 ? <EmptyState title="Queue is clear" /> : <ul className="divide-y divide-line">{[...anQueue].sort((a, b) => a.updated.localeCompare(b.updated)).slice(0, 4).map((t) => <li key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm"><div className="min-w-0 flex-1"><p className="truncate font-medium">{t.id} · p.{t.page}</p><p className="text-xs text-muted">{t.assignee} · {t.file}</p></div><AgeBadge iso={t.updated} /><Button size="sm" onClick={() => void claimTask(t)}>Claim</Button></li>)}</ul>}</Card>
      </div>
    </>
  );
}

/* ---------------- Dataset reviews ---------------- */
const QTABS = ["queue", "mine"] as const;
type QTab = (typeof QTABS)[number];
export function DatasetReviews() {
  const loading = useFakeLoad(500);
  const [tab, setTab] = useQueryState<QTab>("tab", "queue", QTABS);
  const { claims, claim } = useDatasetClaims(); const router = useRouter();
  const queue = DATASET_REVIEWS.filter((r) => !claims[r.id]); const mine = DATASET_REVIEWS.filter((r) => claims[r.id] === REVIEWER);
  const [busy, setBusy] = useState<string | null>(null);
  const cols: Column<DatasetReview>[] = [
    { key: "t", header: "Dataset", sortValue: (r) => r.title, render: (r) => <div><p className="font-medium">{r.title}</p><p className="text-xs text-muted">{r.datasetId} · {r.id}{r.resubmitted && <span className="ml-1 text-warning">· v2 (resubmitted)</span>}</p></div> },
    { key: "s", header: "Size", sortValue: (r) => r.sizeGb, render: (r) => <span className="tabular">{gb(r.sizeGb)}</span> },
    { key: "f", header: "Files", sortValue: (r) => r.files, render: (r) => <span className="tabular">{r.files.toLocaleString()}</span>, hideOnMobile: true },
    { key: "c", header: "Class", sortValue: (r) => r.kind, render: (r) => <Badge tone={r.kind === "labeled" ? "brand" : "neutral"}>{r.kind === "labeled" ? "Labeled" : "Raw"}</Badge>, hideOnMobile: true },
    { key: "l", header: "Language", render: (r) => r.language, hideOnMobile: true },
    { key: "w", header: "Waiting", sortValue: (r) => r.submitted, render: (r) => <AgeBadge iso={r.submitted} /> },
    { key: "a", header: "", className: "w-28 text-right", render: (r) => claims[r.id] === REVIEWER ? <Button size="sm" variant="outline" href={`/review/datasets/${r.id}`}>Continue</Button> : r.owner === REVIEWER ? <span className="text-xs text-muted">Your dataset</span> : <Button size="sm" loading={busy === r.id} onClick={async () => { setBusy(r.id); const ok = await claim(r); setBusy(null); if (ok) router.push(`/review/datasets/${r.id}`); }}>Claim</Button> }
  ];
  return (
    <>
      <PageHeader title="Dataset reviews" description="Claim a dataset to open the review workspace. Resubmitted datasets open with the previous feedback." />
      <div className="mb-4"><Tabs<QTab> value={tab} onChange={setTab} tabs={[{ id: "queue", label: "Queue", count: queue.length }, { id: "mine", label: "Mine", count: mine.length }]} /></div>
      <DataTable key={tab} rows={tab === "queue" ? queue : mine} columns={cols} loading={loading} searchText={(r) => `${r.title} ${r.datasetId} ${r.id}`}
        filters={[{ label: "Class", options: ["Raw", "Labeled"], predicate: (r, v) => (v === "Labeled") === (r.kind === "labeled") }, { label: "Language", options: ["Khmer", "English"], predicate: (r, v) => r.language === v }]}
        empty={tab === "queue" ? { title: "Queue is clear", description: "New submissions will appear here." } : { title: "No claimed reviews", description: "Claim a dataset from the queue to start." }} />
    </>
  );
}

/* ---------------- History ---------------- */
const HTABS = ["datasets", "annotations"] as const;
type HTab = (typeof HTABS)[number];
export function ReviewHistory() {
  const loading = useFakeLoad(500);
  const [type, setType] = useQueryState<HTab>("type", "datasets", HTABS);
  const { history } = useReviewHistory();
  const [open, setOpen] = useState<ReviewRecord | null>(null);
  const rows = useMemo(() => history.filter((h) => (type === "datasets" ? h.kind === "dataset" : h.kind === "annotation")), [history, type]);
  const cols: Column<ReviewRecord>[] = [
    { key: "at", header: "Finalized", sortValue: (r) => r.at, render: (r) => <span className="tabular text-xs">{r.at}</span> },
    { key: "s", header: type === "datasets" ? "Dataset" : "Task", sortValue: (r) => r.subject, render: (r) => <div><p className="font-medium">{r.subject}</p><p className="text-xs text-muted">{r.ref}{r.annotator ? ` · ${r.annotator}` : ""}</p></div> },
    { key: "d", header: "Decision", sortValue: (r) => r.decision, render: (r) => <StatusBadge status={r.decision === "corrections_requested" ? "changes_requested" : r.decision} /> },
    { key: "sc", header: "Score", sortValue: (r) => r.score ?? 0, render: (r) => (r.score ? `${r.score}/5` : "—"), className: "text-right" },
    type === "datasets" ? { key: "p", header: "Payable", sortValue: (r) => r.payable ?? 0, render: (r) => (r.payable ? usd(r.payable) : "—"), className: "text-right" } : { key: "p", header: "Reward", sortValue: (r) => r.reward ?? 0, render: (r) => (r.reward ? usd(r.reward) : "—"), className: "text-right" }
  ];
  return (
    <>
      <PageHeader title="Review history" description="Read-only records of your finalized reviews." />
      <div className="mb-4"><Tabs<HTab> value={type} onChange={setType} tabs={[{ id: "datasets", label: "Datasets" }, { id: "annotations", label: "Annotations" }]} /></div>
      <DataTable key={type} rows={rows} columns={cols} loading={loading} onRowClick={setOpen} searchText={(r) => `${r.subject} ${r.ref}`}
        filters={[{ label: "Decision", options: ["approved", "partially_approved", "corrections_requested", "rejected"], predicate: (r, v) => r.decision === v }]} empty={{ title: "No review history", description: "Finalized reviews appear here." }} />
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.ref ?? ""} description={open?.subject}>
        {open && <dl className="divide-y divide-line text-sm">{([["Finalized", open.at], ["Reviewer", open.reviewer], ["Decision", open.decision.replace(/_/g, " ")], ["Score", open.score ? `${open.score}/5` : "—"], ...(open.kind === "dataset" ? [["Accepted size", gb(open.acceptedGb ?? 0)], ["Payable", usd(open.payable ?? 0)]] : [["Annotator", open.annotator ?? "—"], ["Reward", usd(open.reward ?? 0)]])] as string[][]).map(([k, v]) => <div key={k} className="flex justify-between py-2.5"><dt className="text-muted">{k}</dt><dd className="font-medium capitalize">{v}</dd></div>)}</dl>}
        {open?.kind === "annotation" && <div className="mt-5"><Button href={`/review/annotations/${open.ref}`} variant="outline" className="w-full">Open comparison</Button></div>}
        <p className="mt-4 text-xs text-muted">Today is {TODAY}. <Link href="/review" className="text-brand hover:underline">Back to dashboard</Link></p>
      </Drawer>
    </>
  );
}
