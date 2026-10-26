"use client";
import Link from "next/link";
import { CheckCircle2, Circle, FileCheck2, Paperclip, ShieldAlert, XCircle } from "lucide-react";
import { Alert, Avatar, Card, CardHeader, EmptyState, PageHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { usd, dateFmt, cn } from "@/lib/cn";
import { users } from "@/mock/data";
import { useFakeLoad } from "@/lib/demo";
import { ACTION_LABEL, ActorSwitch, usePayoutFlow } from "./payout-flow";
import { PayoutHistory } from "./payouts-page";
import { violatesSoD, type PayoutAction, type PayoutStatus } from "./store";

const STEPS: Array<[PayoutStatus, string]> = [["requested", "Requested"], ["under_review", "Under review"], ["approved", "Approved"], ["processing", "Processing"], ["paid", "Paid"]];
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4 py-2 text-sm"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
const ORDER: PayoutAction[] = ["review", "approve", "processing", "record", "failed", "reopen", "reject"];

export function PayoutDetail({ id }: { id: string }) {
  const loading = useFakeLoad(450);
  const { list, run, blockedReason, dialogs, actor } = usePayoutFlow();
  const p = list.find((x) => x.id === id);
  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  if (!p) return <Card><EmptyState title="Payout not found" description={`No payout request with ID ${id}.`} action={<Button href="/admin/payouts" variant="outline">Back to payouts</Button>} /></Card>;
  const user = users.find((u) => u.id === p.userId);
  const idx = STEPS.findIndex(([s]) => s === p.status);
  const terminalBad = p.status === "rejected" || p.status === "failed";
  const actions = ORDER.filter((a) => !blockedReason(p, a) || (a === "record" && (p.status === "approved" || p.status === "processing")));

  return (
    <div>
      <PageHeader title={`Payout ${p.id}`} description={`${usd(p.amount)} to ${p.user} via ${p.method}`}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Payout requests", href: "/admin/payouts" }, { label: p.id }]}
        actions={<><ActorSwitch /><StatusBadge status={p.status} /></>} />
      <Card className="mb-4 p-5">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3" aria-label="Payout progress">
          {STEPS.map(([s, label], i) => {
            const done = !terminalBad && idx >= i;
            return (<li key={s} className="flex items-center gap-2 text-sm">
              {done ? <CheckCircle2 size={18} className="text-success" aria-hidden /> : <Circle size={18} className="text-muted" aria-hidden />}
              <span className={cn(done ? "font-medium" : "text-muted")}>{label}</span>{i < STEPS.length - 1 && <span className="mx-1 hidden h-px w-8 bg-line sm:block" aria-hidden />}
            </li>);
          })}
          {terminalBad && <li className="flex items-center gap-2 text-sm font-medium text-danger"><XCircle size={18} aria-hidden />{p.status === "rejected" ? "Rejected" : "Failed"}</li>}
        </ol>
        {p.reason && <div className="mt-4"><Alert tone="danger" title={p.status === "rejected" ? "Rejection reason" : "Failure reason"}>{p.reason}</Alert></div>}
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => {
            const why = blockedReason(p, a);
            return <Button key={a} variant={a === "approve" || a === "record" ? "primary" : a === "reject" || a === "failed" ? "danger" : "outline"} disabled={!!why} title={why ?? undefined} onClick={() => run(p.id, a)}>{ACTION_LABEL[a]}</Button>;
          })}
          {(p.status === "approved" || p.status === "processing" || p.status === "paid") && <Button variant="outline" onClick={() => run(p.id, "proof")}><Paperclip size={14} aria-hidden />Upload proof</Button>}
          {actions.length === 0 && p.status !== "paid" && <p className="text-sm text-muted">No further actions available.</p>}
        </div>
        {violatesSoD(p, actor) && (p.status === "approved" || p.status === "processing") && (
          <div className="mt-4"><Alert tone="warning" title="Separation of duties"><span className="inline-flex items-center gap-1"><ShieldAlert size={14} aria-hidden /></span> You ({actor.name}) approved this payout, so another administrator must record the external payment.</Alert></div>)}
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card><CardHeader title="Review history" description="Append-only audit trail" /><div className="p-5"><PayoutHistory p={p} /></div></Card>
        </div>
        <div className="space-y-4">
          <Card><CardHeader title="Contributor" /><div className="p-5">
            <div className="mb-3 flex items-center gap-3"><Avatar name={p.user} size={40} /><div><p className="font-medium">{p.user}</p><p className="text-xs text-muted">{user?.email}</p></div></div>
            <dl className="divide-y divide-line">
              <Row k="Verification" v={user ? <StatusBadge status={user.verification} /> : "—"} />
              <Row k="Accepted data" v={`${user?.acceptedGb ?? 0} GB`} /><Row k="Lifetime earnings" v={usd(user?.earnings ?? 0)} /><Row k="Joined" v={user ? dateFmt(user.joined) : "—"} />
            </dl>
            {user && <Link href={`/admin/users/${user.id}`} className="mt-2 inline-block text-sm text-brand hover:underline">View user profile</Link>}
          </div></Card>
          <Card><CardHeader title="Payment details" /><dl className="divide-y divide-line px-5 py-2">
            <Row k="Amount" v={<span className="tabular">{usd(p.amount)}</span>} /><Row k="Method" v={p.method} /><Row k="Wallet / account" v={p.wallet} />
            <Row k="Requested" v={dateFmt(p.requested)} /><Row k="Approved by" v={p.approvedBy ?? "—"} /><Row k="Payment recorded by" v={p.paidBy ?? "—"} />
            <Row k="Payment reference" v={p.reference ? <code className="font-mono text-xs">{p.reference}</code> : "—"} />
            <Row k="Proof" v={p.proof ? <span className="inline-flex items-center gap-1"><FileCheck2 size={14} className="text-success" aria-hidden />{p.proof}</span> : "Not attached"} />
          </dl></Card>
        </div>
      </div>
      {dialogs}
    </div>
  );
}
