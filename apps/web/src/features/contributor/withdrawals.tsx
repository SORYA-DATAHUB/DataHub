"use client";
import { Banknote, Lock, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, useUI } from "@/components/ui/overlays";
import { Alert, Card, CardHeader, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, Stat, StatusBadge, Switch } from "@/components/ui/primitives";
import { usd } from "@/lib/cn";
import { useFakeLoad, wait } from "@/lib/demo";
import { RATES } from "@/mock/data";
import { W_LABEL, fmtDate, wallet, type WStatus, type Withdrawal } from "./data";
import { useDatasets, useForcedState, usePayoutMethods, useQueryParam, useVerification, useWithdrawals } from "./hooks";

export function Withdrawals() {
  const router = useRouter();
  const loading = useFakeLoad(500);
  const { toast } = useUI();
  const { forced, clear } = useForcedState();
  const { datasets } = useDatasets();
  const { withdrawals, add } = useWithdrawals();
  const [verification, setVerification] = useVerification();
  const [methods] = usePayoutMethods();
  const [req, setReq] = useQueryParam("request", "");
  const w = wallet(withdrawals, datasets);
  const eligible = verification === "verified";
  const blockedReason = !eligible ? "Verify your identity to withdraw." : w.available < RATES.minWithdrawal ? `You need at least ${usd(RATES.minWithdrawal)} available. You have ${usd(w.available)}.` : "";

  const cols: Column<Withdrawal>[] = [
    { key: "id", header: "Request", sortValue: (r) => r.id, render: (r) => <Link href={`/withdrawals/${r.id}`} className="font-medium text-brand hover:underline">{r.id}</Link> },
    { key: "date", header: "Requested", sortValue: (r) => r.requested, render: (r) => fmtDate(r.requested) },
    { key: "method", header: "Method", render: (r) => r.method },
    { key: "amount", header: "Amount", sortValue: (r) => r.amount, className: "text-right", render: (r) => <span className="tabular font-medium">{usd(r.amount)}</span> },
    { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status === "processing" ? "processing_payment" : r.status} /> }
  ];
  if (forced === "error") return <><PageHeader title="Withdrawals" /><Card><ErrorState onRetry={clear} /></Card></>;

  return (
    <>
      <PageHeader title="Withdrawals" description="Request a payout of your available balance. Every payout is approved manually by a finance administrator."
        actions={<Button disabled={!!blockedReason} onClick={() => setReq("1")}><Banknote size={14} />Request withdrawal</Button>} />
      {loading ? <div className="space-y-4" aria-busy="true"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div> : (
        <div className="space-y-6">
          {!eligible && <Alert tone="warning" title="Not eligible to withdraw yet" action={<Button size="sm" variant="outline" href="/profile?tab=verification">Verify identity</Button>}>You can upload and earn before verification, but withdrawals unlock only after your identity is verified. Your balance is safe.</Alert>}
          {eligible && w.available < RATES.minWithdrawal && <Alert tone="info" title="Below the minimum withdrawal">The minimum is {usd(RATES.minWithdrawal)}. You have {usd(w.available)} available.</Alert>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Available balance" value={usd(w.available)} hint="Ready to withdraw" tone="brand" icon={Banknote} />
            <Stat label="Reserved" value={usd(w.reserved)} hint="In open requests" tone="warning" />
            <Stat label="Paid out" value={usd(w.paid)} hint="Lifetime" tone="success" />
            <Stat label="Minimum" value={usd(RATES.minWithdrawal)} hint="Per withdrawal" icon={Lock} />
          </div>
          {forced === "empty" ? <Card><EmptyState title="No withdrawals yet" description="Your requests and their status will appear here." /></Card> : (
            <DataTable rows={withdrawals} columns={cols} pageSize={8} searchText={(r) => `${r.id} ${r.method} ${W_LABEL[r.status]}`} onRowClick={(r) => router.push(`/withdrawals/${r.id}`)}
              filters={[{ label: "Status", options: Object.keys(W_LABEL), predicate: (r, v) => r.status === (v as WStatus) }]} empty={{ title: "No withdrawals", description: "Nothing matches these filters." }} />
          )}
          <Card>
            <CardHeader title="Demo controls" description="Only for exploring states in this prototype" />
            <div className="flex items-center justify-between gap-4 p-5"><div className="text-sm"><p className="flex items-center gap-2 font-medium"><ShieldAlert size={14} aria-hidden />Simulate an unverified account</p><p className="text-muted">Turns the not-eligible state on or off. Also reflected in your profile.</p></div>
              <Switch label="Simulate unverified account" checked={!eligible} onChange={(v) => { setVerification(v ? "unverified" : "verified"); toast(v ? "Account now shows as unverified." : "Account verified again.", "info"); }} /></div>
          </Card>
        </div>
      )}
      <RequestDialog open={req === "1" && !loading} onClose={() => setReq(null)} available={w.available} blocked={blockedReason} methods={methods.map((m) => `${m.type} ${"•••"} ${m.account.replace(/\s/g, "").slice(-4)}`)}
        onSubmit={async (amount, method) => {
          await wait(900);
          const id = `PO-${3100 + withdrawals.length}`;
          add({ id, amount, method, requested: "2026-10-26", status: "requested" });
          toast(`Withdrawal ${id} requested. Finance will review it manually. Nothing has been paid yet.`);
          setReq(null); router.push(`/withdrawals/${id}`);
        }} />
    </>
  );
}

function RequestDialog({ open, onClose, available, blocked, methods, onSubmit }: { open: boolean; onClose: () => void; available: number; blocked: string; methods: string[]; onSubmit: (amount: number, method: string) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [err, setErr] = useState<{ amount?: string; method?: string }>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setAmount(""); setMethod(methods[0] ?? ""); setErr({}); setConfirming(false); setBusy(false); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const validate = () => {
    const e: { amount?: string; method?: string } = {};
    const n = Number(amount);
    if (!amount.trim() || Number.isNaN(n)) e.amount = "Enter an amount.";
    else if (n < RATES.minWithdrawal) e.amount = `The minimum withdrawal is ${usd(RATES.minWithdrawal)}.`;
    else if (n > available) e.amount = `You only have ${usd(available)} available.`;
    else if (Math.round(n * 100) !== n * 100 && Math.abs(Math.round(n * 100) - n * 100) > 1e-6) e.amount = "Use at most two decimal places.";
    if (!method) e.method = "Choose a payout method.";
    setErr(e); return Object.keys(e).length === 0;
  };
  return (
    <Modal open={open} onClose={onClose} title={confirming ? "Confirm withdrawal" : "Request withdrawal"} description={confirming ? "Please check the details." : `Available: ${usd(available)}`}
      footer={confirming
        ? <><Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Back</Button><Button loading={busy} onClick={async () => { setBusy(true); await onSubmit(Number(amount), method); }}>Confirm request</Button></>
        : <><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!!blocked} onClick={() => validate() && setConfirming(true)}>Review</Button></>}>
      {blocked ? <Alert tone="warning" title="You cannot withdraw right now">{blocked}</Alert>
        : methods.length === 0 ? <EmptyState title="Add a payout method first" description="You need a payout method before requesting a withdrawal." action={<Button href="/profile?tab=payout-methods">Add payout method</Button>} />
        : confirming ? (
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Amount</dt><dd className="tabular font-semibold">{usd(Number(amount))}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Payout method</dt><dd>{method}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Balance after request</dt><dd className="tabular">{usd(available - Number(amount))}</dd></div>
            <Alert tone="info" title="What happens next">The amount is reserved now. A finance administrator reviews and approves it manually, then payment is processed. This is a demo, so no money moves.</Alert>
          </dl>
        ) : (
          <div className="space-y-4">
            <Field label="Amount (USD)" required error={err.amount} hint={`Minimum ${usd(RATES.minWithdrawal)}, maximum ${usd(available)}`}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!err.amount} inputMode="decimal" placeholder="25.00" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
            <button type="button" className="text-xs text-brand hover:underline" onClick={() => setAmount(available.toFixed(2))}>Use full balance ({usd(available)})</button>
            <Field label="Payout method" required error={err.method}>{(id, d) => <Select id={id} aria-describedby={d} value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map((m) => <option key={m}>{m}</option>)}</Select>}</Field>
          </div>
        )}
    </Modal>
  );
}
