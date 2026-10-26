"use client";
import { Copy, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/ui/overlays";
import { Alert, Card, CardHeader, EmptyState, PageHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { cn, usd } from "@/lib/cn";
import { useFakeLoad } from "@/lib/demo";
import { W_LABEL, fmtDate, withdrawalEvents } from "./data";
import { useWithdrawals } from "./hooks";

const TONE: Record<string, string> = { neutral: "bg-line", brand: "bg-brand", success: "bg-success", warning: "bg-warning", danger: "bg-danger" };

export function WithdrawalDetail({ id }: { id: string }) {
  const loading = useFakeLoad(450);
  const { toast } = useUI();
  const { withdrawals } = useWithdrawals();
  const w = withdrawals.find((x) => x.id === id);
  if (loading) return <div className="space-y-4" aria-busy="true"><Skeleton className="h-10 w-64" /><Skeleton className="h-72" /></div>;
  if (!w) return <Card><EmptyState title="Withdrawal not found" description={`No withdrawal ${id} exists in your account.`} action={<Button href="/withdrawals">Back to withdrawals</Button>} /></Card>;
  const events = withdrawalEvents(w);
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Withdrawals", href: "/withdrawals" }, { label: w.id }]} title={`Withdrawal ${w.id}`} description={`Requested ${fmtDate(w.requested)}`} actions={<StatusBadge status={w.status === "processing" ? "processing_payment" : w.status} />} />
      {w.status === "rejected" && <div className="mb-4"><Alert tone="danger" title="This withdrawal was rejected">{w.note} Your funds were returned to your available balance.</Alert></div>}
      {w.status === "failed" && <div className="mb-4"><Alert tone="danger" title="Payment failed" action={<Button size="sm" variant="outline" href="/messages">Contact support</Button>}>{w.note}</Alert></div>}
      {w.status === "paid" && <div className="mb-4"><Alert tone="success" title="Payment completed">Reference {w.reference}. Keep this for your records.</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Status timeline" description={`Current status: ${W_LABEL[w.status]}`} />
          <ol className="p-5">{events.map((e, i) => (
            <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
              {i < events.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-line" aria-hidden />}
              <span className={cn("relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-surface", TONE[e.tone])} aria-hidden />
              <div><p className="text-sm font-medium">{e.title}</p>{e.detail && <p className="text-sm text-muted">{e.detail}</p>}<p className="text-xs text-muted">{fmtDate(e.at)}</p></div>
            </li>))}</ol>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="space-y-3 p-5 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">Amount</dt><dd className="tabular font-semibold">{usd(w.amount)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Fee</dt><dd className="tabular">{usd(0)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Method</dt><dd className="text-right">{w.method}</dd></div>
              <div className="flex items-center justify-between gap-4"><dt className="text-muted">Payment reference</dt>
                <dd className="flex items-center gap-1.5">{w.reference ? <><span className="font-mono text-xs">{w.reference}</span><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Copy reference" onClick={() => { void navigator.clipboard?.writeText(w.reference ?? ""); toast("Reference copied."); }}><Copy size={13} /></Button></> : <span className="text-muted">Not assigned yet</span>}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Proof of payment" />
            <div className="p-5">{w.status === "paid" ? (
              <div className="flex items-center gap-3 rounded-lg border border-line p-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface2 text-muted"><FileText size={18} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">receipt_{w.reference}.pdf</p><p className="text-xs text-muted">Placeholder attachment</p></div>
                <Button size="sm" variant="outline" onClick={() => toast("Receipt download is simulated in demo mode.", "info")}>Download</Button></div>
            ) : <div className="text-center"><span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-muted"><Upload size={16} /></span><p className="text-sm text-muted">Proof of payment appears here once the payment is completed.</p></div>}</div>
          </Card>
        </div>
      </div>
    </>
  );
}
