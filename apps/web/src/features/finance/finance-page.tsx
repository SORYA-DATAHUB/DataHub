"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BadgeCheck, Banknote, Clock, Download, Lock, PiggyBank, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardHeader, DeniedState, EmptyState, Field, Input, PageHeader, Select, Skeleton, Stat, StatusBadge, Textarea } from "@/components/ui/primitives";
import { Tabs, useUI } from "@/components/ui/overlays";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Bars, Donut } from "@/components/ui/charts";
import { dateFmt, usd } from "@/lib/cn";
import { monthly, users } from "@/mock/data";
import { useFakeLoad, wait } from "@/lib/demo";
import { ActorSwitch } from "./payout-flow";
import { ACTIVE, buildLedger, useActor, useAdjustments, usePayouts, type LedgerEntry } from "./store";

type Tab = "overview" | "ledger" | "reconciliation" | "adjustments";
const TABS: Array<{ id: Tab; label: string }> = [{ id: "overview", label: "Overview" }, { id: "ledger", label: "Ledger" }, { id: "reconciliation", label: "Reconciliation" }, { id: "adjustments", label: "Adjustments" }];
const typeTone = { earning: "success", reserve: "warning", release: "brand", payout: "neutral", adjustment: "danger" } as const;

export function FinancePage() {
  const loading = useFakeLoad(500);
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams();
  const raw = sp.get("tab") as Tab | null;
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : "overview";
  const { list } = usePayouts();
  const [adj, setAdj] = useAdjustments();
  const { actor } = useActor();
  const ledger = useMemo(() => buildLedger(list, adj), [list, adj]);

  const approvedEarnings = users.reduce((s, u) => s + u.earnings, 0);
  const reserved = list.filter((p) => ACTIVE.includes(p.status)).reduce((s, p) => s + p.amount, 0);
  const totalPaid = list.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const outstanding = list.filter((p) => p.status === "requested" || p.status === "under_review");
  const adjTotal = adj.reduce((s, a) => s + a.amount, 0);

  return (
    <div>
      <PageHeader title="Finance" description="Approved earnings, reserved withdrawals and the append-only ledger. Payments are recorded after being made externally." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Finance" }]}
        actions={<><ActorSwitch /><Button variant="outline" onClick={() => router.push("/admin/payouts")}><Wallet size={14} aria-hidden />Payout requests</Button></>} />
      <Tabs tabs={TABS} value={tab} onChange={(v) => router.replace(v === "overview" ? path : `${path}?tab=${v}`)} />
      <div className="mt-5">
        {loading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div> : (<>
          {tab === "overview" && <Overview {...{ approvedEarnings: approvedEarnings + adjTotal, reserved, totalPaid, outstanding: outstanding.length, outstandingAmt: outstanding.reduce((s, p) => s + p.amount, 0), ledger, list }} />}
          {tab === "ledger" && <Ledger ledger={ledger} />}
          {tab === "reconciliation" && <Reconciliation />}
          {tab === "adjustments" && (actor.role === "super_admin" ? <Adjustments adj={adj} setAdj={setAdj} actorName={actor.name} /> : <Card><DeniedState role="Super Administrator" /></Card>)}
        </>)}
      </div>
    </div>
  );
}

function Overview({ approvedEarnings, reserved, totalPaid, outstanding, outstandingAmt, ledger, list }: {
  approvedEarnings: number; reserved: number; totalPaid: number; outstanding: number; outstandingAmt: number; ledger: LedgerEntry[]; list: ReturnType<typeof usePayouts>["list"];
}) {
  const statusData = ["requested", "under_review", "approved", "processing", "paid", "rejected", "failed"].map((s) => ({ name: s.replace("_", " "), value: list.filter((p) => p.status === s).length })).filter((d) => d.value > 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Approved earnings" value={usd(approvedEarnings)} icon={BadgeCheck} tone="success" hint="Locked at approval rates" />
        <Stat label="Outstanding requests" value={outstanding} icon={Clock} tone="warning" hint={`${usd(outstandingAmt)} awaiting decision`} />
        <Stat label="Reserved amount" value={usd(reserved)} icon={PiggyBank} hint="Held for in-flight payouts" />
        <Stat label="Total paid (recorded)" value={usd(totalPaid)} icon={Banknote} tone="neutral" hint="External payments recorded" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader title="Monthly earnings approved" description="USD, last 6 months" />
          <div className="p-4"><Bars data={monthly.map((m) => ({ m: m.m, Earnings: m.earnings }))} x="m" series={["Earnings"]} height={240} /></div></Card>
        <Card><CardHeader title="Payouts by status" /><div className="p-4">{statusData.length ? <Donut data={statusData} /> : <EmptyState title="No payouts" />}</div></Card>
      </div>
      <Card><CardHeader title="Recent transactions" action={<Link href="/admin/finance?tab=ledger" className="text-sm text-brand hover:underline">View ledger</Link>} />
        {ledger.length === 0 ? <EmptyState title="No transactions yet" /> : (
          <ul className="divide-y divide-line">{ledger.slice(0, 6).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0"><p className="truncate font-medium">{e.user} <span className="font-normal text-muted">· {e.note}</span></p><p className="text-xs text-muted">{dateFmt(e.date)} · {e.ref}</p></div>
              <div className="flex items-center gap-3"><Badge tone={typeTone[e.type]}>{e.type}</Badge><span className={`tabular w-20 text-right font-medium ${e.amount < 0 ? "text-danger" : ""}`}>{usd(e.amount)}</span></div>
            </li>))}</ul>)}
      </Card>
    </div>
  );
}

function Ledger({ ledger }: { ledger: LedgerEntry[] }) {
  const { toast } = useUI();
  const cols: Column<LedgerEntry>[] = [
    { key: "id", header: "Entry", sortValue: (r) => r.id, render: (r) => <code className="font-mono text-xs">{r.id}</code> },
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => dateFmt(r.date) },
    { key: "type", header: "Type", sortValue: (r) => r.type, render: (r) => <Badge tone={typeTone[r.type]}>{r.type}</Badge> },
    { key: "user", header: "Contributor", sortValue: (r) => r.user, render: (r) => r.user },
    { key: "ref", header: "Reference", render: (r) => r.ref },
    { key: "note", header: "Note", hideOnMobile: true, render: (r) => <span className="text-muted">{r.note}</span> },
    { key: "amount", header: "Amount", className: "tabular text-right", sortValue: (r) => r.amount, render: (r) => <span className={r.amount < 0 ? "text-danger" : ""}>{usd(r.amount)}</span> }
  ];
  return (
    <div className="space-y-3">
      <Alert tone="info" title="Append-only ledger">Entries cannot be edited or deleted. Corrections are posted as new adjustment entries.</Alert>
      <DataTable rows={ledger} columns={cols} pageSize={10} searchText={(r) => `${r.id} ${r.user} ${r.ref} ${r.note}`}
        filters={[{ label: "Type", options: ["earning", "reserve", "release", "payout", "adjustment"], predicate: (r, v) => r.type === v }, { label: "Contributor", options: users.filter((u) => u.earnings > 0).map((u) => u.name), predicate: (r, v) => r.user === v }]}
        toolbar={<Button variant="outline" size="sm" onClick={() => toast("Ledger CSV export queued (demo)", "info")}><Download size={14} aria-hidden />Export CSV</Button>}
        empty={{ title: "No ledger entries match" }} />
    </div>
  );
}

function Reconciliation() {
  const { list } = usePayouts();
  const { toast } = useUI();
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const paid = list.filter((p) => p.status === "paid");
  const rows = paid.map((p) => ({ id: p.id, p, ok: !!p.reference && !!p.proof }));
  const cols: Column<(typeof rows)[number]>[] = [
    { key: "id", header: "Payout", render: (r) => <Link className="text-brand hover:underline" href={`/admin/payouts/${r.id}`}>{r.id}</Link> },
    { key: "user", header: "Contributor", render: (r) => r.p.user },
    { key: "amt", header: "Amount", className: "tabular", render: (r) => usd(r.p.amount) },
    { key: "ref", header: "Reference", render: (r) => r.p.reference ? <code className="font-mono text-xs">{r.p.reference}</code> : <span className="text-danger">Missing</span> },
    { key: "proof", header: "Proof", render: (r) => r.p.proof ?? <span className="text-danger">Missing</span> },
    { key: "st", header: "Status", render: (r) => <StatusBadge status={r.ok ? "ok" : "pending"} /> }
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Recorded payments" value={rows.length} icon={Banknote} />
        <Stat label="Fully matched" value={rows.filter((r) => r.ok).length} icon={BadgeCheck} tone="success" hint="Reference and proof present" />
        <Stat label="Needs attention" value={rows.filter((r) => !r.ok).length} icon={Clock} tone="warning" hint="Missing reference or proof" />
      </div>
      <Alert tone="info" title="Manual reconciliation">DataHub does not see bank movements. Reconciliation checks that each recorded external payment has a reference and proof attached.{lastRun && ` Last check: ${lastRun}.`}</Alert>
      <DataTable rows={rows} columns={cols} pageSize={8}
        toolbar={<Button size="sm" loading={running} onClick={async () => { setRunning(true); await wait(900); setRunning(false); setLastRun(new Date().toLocaleTimeString()); toast("Reconciliation check complete"); }}><RefreshCw size={14} aria-hidden />Run check</Button>}
        empty={{ title: "No recorded payments yet", description: "Recorded external payments will be reconciled here." }} />
    </div>
  );
}

function Adjustments({ adj, setAdj, actorName }: { adj: ReturnType<typeof useAdjustments>[0]; setAdj: ReturnType<typeof useAdjustments>[1]; actorName: string }) {
  const { toast, confirm } = useUI();
  const [userId, setUserId] = useState(users.filter((u) => u.earnings > 0)[0].id);
  const [dir, setDir] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errs, setErrs] = useState<{ amount?: string; reason?: string }>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount); const er: typeof errs = {};
    if (!(n > 0) || n > 10000) er.amount = "Enter an amount between $0.01 and $10,000.";
    if (reason.trim().length < 10) er.reason = "A super administrator note of at least 10 characters is required.";
    setErrs(er); if (Object.keys(er).length) return;
    const u = users.find((x) => x.id === userId)!; const signed = dir === "credit" ? n : -n;
    if (!await confirm({ title: "Post ledger adjustment?", description: `Posts a ${dir} of ${usd(n)} to ${u.name}. Entries are permanent; mistakes are corrected with a new offsetting entry.`, confirmLabel: "Post adjustment", danger: dir === "debit" })) return;
    setAdj((p) => [{ id: `LG-A${p.length + 1}`, at: new Date().toISOString(), userId, user: u.name, amount: signed, reason: reason.trim(), by: actorName }, ...p]);
    setAmount(""); setReason(""); toast("Adjustment appended to the ledger");
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader title="New adjustment" description="Super administrator only. Creates a new ledger entry." />
        <form onSubmit={submit} className="space-y-4 p-5" noValidate>
          <Field label="Contributor">{(id) => <Select id={id} value={userId} onChange={(e) => setUserId(e.target.value)}>{users.filter((u) => u.roles.some((r) => r === "Contributor" || r === "Annotator")).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">{(id) => <Select id={id} value={dir} onChange={(e) => setDir(e.target.value as "credit" | "debit")}><option value="credit">Credit (add)</option><option value="debit">Debit (subtract)</option></Select>}</Field>
            <Field label="Amount (USD)" required error={errs.amount}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.amount} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />}</Field>
          </div>
          <Field label="Super admin note" required error={errs.reason} hint="Recorded permanently in the audit log.">{(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errs.reason} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          <Button type="submit"><Lock size={14} aria-hidden />Append to ledger</Button>
        </form></Card>
      <Card><CardHeader title="Posted adjustments" description={`${adj.length} entr${adj.length === 1 ? "y" : "ies"}`} />
        {adj.length === 0 ? <EmptyState title="No adjustments posted" description="Adjustments you post appear here and in the ledger." /> : (
          <ul className="divide-y divide-line">{adj.map((a) => (
            <li key={a.id} className="px-5 py-3 text-sm"><div className="flex justify-between"><span className="font-medium">{a.user}</span><span className={`tabular font-medium ${a.amount < 0 ? "text-danger" : "text-success"}`}>{a.amount < 0 ? "-" : "+"}{usd(Math.abs(a.amount))}</span></div>
              <p className="text-muted">{a.reason}</p><p className="mt-0.5 text-xs text-muted">{a.id} · {a.by} · {dateFmt(a.at)}</p></li>))}</ul>)}
      </Card>
    </div>
  );
}
