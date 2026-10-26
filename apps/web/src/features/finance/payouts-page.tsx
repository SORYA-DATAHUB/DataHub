"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { Alert, Avatar, Badge, PageHeader, StatusBadge, Stat } from "@/components/ui/primitives";
import { Drawer, Menu, Tabs } from "@/components/ui/overlays";
import { DataTable, type Column } from "@/components/ui/data-table";
import { dateFmt, usd } from "@/lib/cn";
import { RATES } from "@/mock/data";
import { useFakeLoad } from "@/lib/demo";
import { ACTION_LABEL, ActorSwitch, usePayoutFlow } from "./payout-flow";
import { ACTIVE, type PayoutAction, type PayoutRec, type PayoutStatus } from "./store";

const TABS: Array<{ id: "all" | PayoutStatus; label: string }> = [
  { id: "all", label: "All" }, { id: "requested", label: "Requested" }, { id: "under_review", label: "Under review" }, { id: "approved", label: "Approved" },
  { id: "processing", label: "Processing" }, { id: "paid", label: "Paid" }, { id: "rejected", label: "Rejected" }, { id: "failed", label: "Failed" }
];
const ROW_ACTIONS: PayoutAction[] = ["review", "approve", "reject", "processing", "record", "failed", "reopen", "proof"];

export function PayoutHistory({ p }: { p: PayoutRec }) {
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {p.events.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden />
          <p className="text-sm font-medium">{e.action}</p>
          <p className="text-xs text-muted">{e.actor} · {new Date(e.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
          {e.note && <p className="mt-1 text-sm text-fg/80">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export function PayoutsPage() {
  const loading = useFakeLoad(450);
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams();
  const { list, run, blockedReason, dialogs, actor } = usePayoutFlow();
  const [hist, setHist] = useState<string | null>(null);
  const raw = sp.get("status") ?? "all";
  const status = TABS.some((t) => t.id === raw) ? (raw as "all" | PayoutStatus) : "all";
  const rows = status === "all" ? list : list.filter((p) => p.status === status);
  const histRec = list.find((p) => p.id === hist);
  const active = list.filter((p) => ACTIVE.includes(p.status));

  const cols: Column<PayoutRec>[] = [
    { key: "id", header: "Request", sortValue: (r) => r.id, render: (r) => <Link href={`/admin/payouts/${r.id}`} className="font-medium text-brand hover:underline">{r.id}</Link> },
    { key: "user", header: "Contributor", sortValue: (r) => r.user, render: (r) => <span className="flex items-center gap-2"><Avatar name={r.user} size={24} />{r.user}</span> },
    { key: "amount", header: "Amount", sortValue: (r) => r.amount, className: "tabular text-right", render: (r) => usd(r.amount) },
    { key: "method", header: "Method", render: (r) => r.method },
    { key: "requested", header: "Requested", sortValue: (r) => r.requested, render: (r) => dateFmt(r.requested) },
    { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", header: "Actions", className: "w-12", render: (r) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Menu label={`Actions for ${r.id}`} items={[
          { label: "View details", onClick: () => router.push(`/admin/payouts/${r.id}`) },
          { label: "View history", onClick: () => setHist(r.id) }, "sep",
          ...ROW_ACTIONS.filter((a) => !(a === "reject" || a === "failed") || !blockedReason(r, a)).map((a) => ({
            label: ACTION_LABEL[a], onClick: () => run(r.id, a), disabled: !!blockedReason(r, a), danger: a === "reject" || a === "failed"
          }))
        ]} />
      </div>) }
  ];

  return (
    <div>
      <PageHeader title="Payout requests" description="Review, approve and record external payments. Payments are made manually outside DataHub." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Payout requests" }]} actions={<ActorSwitch />} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Awaiting review" value={list.filter((p) => p.status === "requested" || p.status === "under_review").length} icon={Wallet} tone="warning" />
        <Stat label="Approved, unpaid" value={list.filter((p) => p.status === "approved" || p.status === "processing").length} hint="Needs external payment" />
        <Stat label="Reserved amount" value={usd(active.reduce((s, p) => s + p.amount, 0))} hint="Held from balances" />
        <Stat label="Minimum withdrawal" value={usd(RATES.minWithdrawal)} hint="Per business rules" />
      </div>
      <Alert tone="info" title={`Acting as ${actor.name}`}>Separation of duties applies: whoever approves a payout cannot record its external payment. Use the demo switcher to change administrator.</Alert>
      <div className="mt-4">
        <Tabs tabs={TABS.map((t) => ({ ...t, count: t.id === "all" ? list.length : list.filter((p) => p.status === t.id).length }))} value={status}
          onChange={(v) => router.replace(v === "all" ? path : `${path}?status=${v}`)} />
      </div>
      <div className="mt-4">
        <DataTable rows={rows} columns={cols} loading={loading} pageSize={8} searchText={(r) => `${r.id} ${r.user} ${r.method} ${r.reference ?? ""}`}
          filters={[{ label: "Method", options: ["Bank transfer (ABA)", "Wing", "PayPal"], predicate: (r, v) => r.method === v }]}
          onRowClick={(r) => router.push(`/admin/payouts/${r.id}`)}
          empty={{ title: "No payout requests", description: status === "all" ? "Requests from contributors will appear here." : `Nothing is currently ${status.replace("_", " ")}.` }} />
      </div>
      <Drawer open={!!histRec} onClose={() => setHist(null)} title={histRec ? `History · ${histRec.id}` : "History"} description={histRec ? `${histRec.user} · ${usd(histRec.amount)}` : undefined}>
        {histRec && <><div className="mb-4"><Badge tone="neutral">Append-only audit trail</Badge></div><PayoutHistory p={histRec} /></>}
      </Drawer>
      {dialogs}
    </div>
  );
}
