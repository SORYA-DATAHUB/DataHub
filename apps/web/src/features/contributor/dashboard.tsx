"use client";
import { AlertTriangle, ArrowRight, Banknote, CheckCircle2, Clock, CloudUpload, Database, HardDriveUpload, Hourglass, Wallet, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AreaTrend, Donut } from "@/components/ui/charts";
import { Alert, Card, CardHeader, EmptyState, ErrorState, PageHeader, Select, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useFakeLoad } from "@/lib/demo";
import { gb, usd } from "@/lib/cn";
import { CATEGORY_HINTS, STATUS_LABEL, STATUSES, approvedEarnings, estimatedEarnings, fmtDate, monthlyEarnings, pendingGb, rejectedGb, wallet } from "./data";
import { useDatasets, useForcedState, useNotifs, useVerification, useWithdrawals } from "./hooks";
import { NotifIcon } from "./notif-icon";

export function Dashboard() {
  const loading = useFakeLoad(600);
  const router = useRouter();
  const { forced, clear } = useForcedState();
  const { datasets } = useDatasets();
  const { withdrawals } = useWithdrawals();
  const [verification] = useVerification();
  const [notifs] = useNotifs();
  const [category, setCategory] = useState("");
  const w = wallet(withdrawals, datasets);
  const k = useMemo(() => ({
    uploaded: datasets.reduce((a, d) => a + d.sizeGb, 0), accepted: datasets.reduce((a, d) => a + d.acceptedGb, 0),
    rejected: datasets.reduce((a, d) => a + rejectedGb(d), 0), pending: datasets.reduce((a, d) => a + pendingGb(d), 0)
  }), [datasets]);
  const dist = STATUSES.map((s) => ({ name: STATUS_LABEL[s], value: datasets.filter((d) => d.status === s).length })).filter((x) => x.value > 0);
  const recent = [...datasets].sort((a, b) => b.uploaded.localeCompare(a.uploaded)).slice(0, 5);
  const changes = datasets.filter((d) => d.status === "changes_requested");
  const drafts = datasets.filter((d) => d.status === "uploading");
  const unread = notifs.filter((n) => !n.read).length;

  if (forced === "error") return <><PageHeader title="Dashboard" /><Card><ErrorState onRetry={clear} /></Card></>;
  return (
    <>
      <PageHeader title="Welcome back, Sokha" description="Your uploads, review status and earnings at a glance. Amounts marked estimated are not paid until reviewers approve the data."
        actions={<><Button variant="outline" href="/withdrawals?request=1"><Wallet size={14} />Withdraw</Button><Button href="/datasets/new"><CloudUpload size={14} />Upload dataset</Button></>} />

      <div className="mb-6 space-y-3">
        {verification !== "verified" && <Alert tone="info" title={verification === "pending" ? "Verification in review" : "Verify your identity to withdraw"}
          action={<Button size="sm" variant="outline" href="/profile?tab=verification">{verification === "pending" ? "View status" : "Verify identity"}</Button>}>You can keep uploading, but withdrawals unlock only after verification is approved.</Alert>}
        {changes.length > 0 && <Alert tone="warning" title={`Changes requested on ${changes.length} dataset${changes.length > 1 ? "s" : ""}`}
          action={<Button size="sm" variant="outline" href={`/datasets/${changes[0].id}?tab=feedback`}>Review feedback</Button>}>Fix the flagged files and resubmit to keep them eligible for earnings.</Alert>}
        {drafts.length > 0 && <Alert tone="info" title={`${drafts[0].title} is still uploading`}
          action={<Button size="sm" variant="outline" href={`/datasets/${drafts[0].id}/upload`}>Continue upload</Button>}>Uploads can be paused and resumed at any time.</Alert>}
      </div>

      {loading ? <DashSkeleton /> : (
        <div className="space-y-6">
          <section aria-label="Upload volume" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Uploaded" value={gb(k.uploaded)} hint={`${datasets.length} datasets`} icon={HardDriveUpload} />
            <Stat label="Accepted" value={gb(k.accepted)} hint="Eligible to earn" icon={CheckCircle2} tone="success" />
            <Stat label="Rejected" value={gb(k.rejected)} hint="Does not earn" icon={XCircle} tone="danger" />
            <Stat label="Pending review" value={gb(k.pending)} hint="Waiting for a decision" icon={Hourglass} tone="warning" />
          </section>
          <section aria-label="Earnings" className="grid gap-3 sm:grid-cols-3">
            <Stat label="Estimated earnings" value={usd(datasets.reduce((a, d) => a + estimatedEarnings(d), 0))} hint="From data in review. Not paid yet." icon={Clock} tone="warning" />
            <Stat label="Approved earnings" value={usd(w.approved)} hint="Credited after review, lifetime" icon={Banknote} tone="success" />
            <Card className="flex flex-col justify-between border-brand/30 bg-brand-soft/40 p-4">
              <div><p className="text-xs font-medium text-muted">Available balance</p><p className="tabular mt-2 text-2xl font-semibold tracking-tight">{usd(w.available)}</p>
                <p className="mt-1 text-xs text-muted">{usd(w.reserved)} reserved in withdrawals · minimum withdrawal $25</p></div>
              <Button size="sm" className="mt-3 self-start" href="/withdrawals?request=1">Withdraw<ArrowRight size={13} /></Button>
            </Card>
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader title="Approved earnings by month" description="Money credited after review, in USD" action={<Button variant="ghost" size="sm" href="/earnings">Details</Button>} />
                <div className="p-4"><AreaTrend data={monthlyEarnings} x="m" series={["earnings"]} money /></div>
              </Card>
              <Card>
                <CardHeader title="Recent upload activity" action={<Button variant="ghost" size="sm" href="/datasets">View all</Button>} />
                {recent.length === 0 ? <EmptyState icon={Database} title="No uploads yet" description="Upload your first dataset to start earning." action={<Button href="/datasets/new">Upload dataset</Button>} /> : (
                  <ul className="divide-y divide-line">{recent.map((d) => (
                    <li key={d.id}><Link href={`/datasets/${d.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface2/50">
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{d.title}</span><span className="text-xs text-muted">{d.id} · {fmtDate(d.uploaded)} · {gb(d.sizeGb)}</span></span>
                      <span className="hidden text-right text-xs sm:block"><span className="tabular block font-medium">{d.acceptedGb > 0 ? usd(approvedEarnings(d)) : usd(estimatedEarnings(d))}</span><span className="text-muted">{d.acceptedGb > 0 ? "approved" : "estimated"}</span></span>
                      <StatusBadge status={d.status} />
                    </Link></li>))}</ul>)}
              </Card>
            </div>
            <div className="space-y-6">
              <Card>
                <CardHeader title="Quick upload" description="Choose what you are uploading" />
                <div className="space-y-3 p-4">
                  <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Choose category</option>{Object.keys(CATEGORY_HINTS).map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <button onClick={() => router.push(`/datasets/new${category ? `?category=${encodeURIComponent(category)}` : ""}`)}
                    className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center text-sm transition-colors hover:border-brand hover:bg-brand-soft/40">
                    <CloudUpload size={22} className="text-brand" /><span className="font-medium">Start an upload</span><span className="text-xs text-muted">Raw $1.00/GB · Labeled $1.50/GB, accepted data only</span>
                  </button>
                </div>
              </Card>
              <Card>
                <CardHeader title="Status distribution" description="Datasets by review status" />
                <div className="px-2 pb-2">{dist.length ? <Donut data={dist} /> : <EmptyState title="No data yet" />}</div>
              </Card>
              <Card>
                <CardHeader title="Notifications" description={unread ? `${unread} unread` : "All caught up"} action={<Button variant="ghost" size="sm" href="/notifications">View all</Button>} />
                <ul className="divide-y divide-line">{notifs.slice(0, 4).map((n) => (
                  <li key={n.id}><Link href={n.href} className="flex gap-3 px-5 py-3 hover:bg-surface2/50">
                    <NotifIcon type={n.type} /><span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-medium">{n.title}{!n.read && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="Unread" />}</span>
                      <span className="line-clamp-2 text-xs text-muted">{n.body}</span><span className="text-[11px] text-muted">{n.time}</span></span></Link></li>))}</ul>
              </Card>
              <p className="flex items-start gap-2 rounded-lg bg-surface2 p-3 text-xs text-muted"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />Uploaded does not mean paid. Only accepted, unique and eligible data earns, and payouts are approved manually.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DashSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true"><span className="sr-only">Loading dashboard</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-80 lg:col-span-2" /><Skeleton className="h-80" /></div>
    </div>
  );
}
