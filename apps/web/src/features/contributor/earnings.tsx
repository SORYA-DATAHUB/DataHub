"use client";
import { Download } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Bars, Donut } from "@/components/ui/charts";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tabs, useUI } from "@/components/ui/overlays";
import { Alert, Badge, Card, CardHeader, ErrorState, PageHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { usd } from "@/lib/cn";
import { useFakeLoad } from "@/lib/demo";
import { TODAY, creditSeeds, earningsByCategory, fmtDate, monthlyEarnings, wallet, type Tx } from "./data";
import { useDatasets, useForcedState, useQueryParam, useWithdrawals } from "./hooks";

const DAY = 86400000;
const within = (iso: string, days: number) => new Date(TODAY).getTime() - new Date(iso).getTime() <= days * DAY;

export function Earnings() {
  const loading = useFakeLoad(500);
  const { toast } = useUI();
  const { forced, clear } = useForcedState();
  const [tabRaw, setTab] = useQueryParam("tab", "summary");
  const tab = tabRaw === "transactions" ? "transactions" : "summary";
  const { datasets } = useDatasets();
  const { withdrawals } = useWithdrawals();
  const w = wallet(withdrawals, datasets);
  const txs = useMemo<Tx[]>(() => [
    ...withdrawals.filter((x) => x.status === "paid" || ["requested", "under_review", "approved", "processing"].includes(x.status)).map<Tx>((x) => ({
      id: `TX-${x.id}`, date: x.requested, type: x.status === "paid" ? "payout" : "reserved", description: `Withdrawal to ${x.method}${x.status === "paid" ? "" : " (reserved, not paid yet)"}`, ref: x.id, amount: -x.amount })),
    ...creditSeeds
  ].sort((a, b) => b.date.localeCompare(a.date)), [withdrawals]);

  const cols: Column<Tx>[] = [
    { key: "date", header: "Date", sortValue: (t) => t.date, render: (t) => <span className="whitespace-nowrap">{fmtDate(t.date)}</span> },
    { key: "desc", header: "Description", render: (t) => <span>{t.description}</span> },
    { key: "type", header: "Type", render: (t) => <Badge tone={t.type === "credit" ? "success" : t.type === "payout" ? "brand" : "warning"} dot>{t.type === "credit" ? "Earning" : t.type === "payout" ? "Payout" : "Reserved"}</Badge> },
    { key: "ref", header: "Reference", hideOnMobile: true, render: (t) => <span className="font-mono text-xs text-muted">{t.ref}</span> },
    { key: "amount", header: "Amount", className: "text-right", sortValue: (t) => t.amount, render: (t) => <span className={`tabular font-medium ${t.amount < 0 ? "" : "text-success"}`}>{t.amount < 0 ? "-" : "+"}{usd(Math.abs(t.amount))}</span> }
  ];
  if (forced === "error") return <><PageHeader title="Earnings" /><Card><ErrorState onRetry={clear} /></Card></>;

  return (
    <>
      <PageHeader title="Earnings" description="Raw data earns $1.00 and labeled data $1.50 per accepted GB. Only accepted, unique and eligible data earns."
        actions={<><Button variant="outline" onClick={() => toast("Export is simulated in demo mode. No file was created.", "info")}><Download size={14} />Export CSV</Button><Button href="/withdrawals?request=1">Withdraw</Button></>} />
      <Tabs tabs={[{ id: "summary", label: "Summary" }, { id: "transactions", label: "Transactions", count: txs.length }]} value={tab} onChange={(t) => setTab(t)} />
      <div className="mt-6" role="tabpanel">
        {loading ? <div className="space-y-4" aria-busy="true"><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-72" /></div> : tab === "summary" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat label="Estimated" value={usd(w.pending)} hint="In review. Not earned yet" tone="warning" />
              <Stat label="Pending payout" value={usd(w.reserved)} hint="Reserved in withdrawals" tone="warning" />
              <Stat label="Approved" value={usd(w.approved)} hint="Lifetime credited" tone="success" />
              <Stat label="Available" value={usd(w.available)} hint="Ready to withdraw" tone="brand" />
              <Stat label="Paid" value={usd(w.paid)} hint="Sent to you" tone="success" />
            </div>
            <Alert tone="info" title="How earnings work">Estimated money becomes approved only after reviewers accept files. Approved money becomes available, and you can withdraw it manually once verified (minimum $25).</Alert>
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2"><CardHeader title="Approved earnings by month" description="USD credited after review" /><div className="p-4"><Bars data={monthlyEarnings} x="m" series={["earnings"]} /></div></Card>
              <Card><CardHeader title="By category" description="Share of approved earnings" /><div className="px-2 pb-2"><Donut data={earningsByCategory} /></div></Card>
            </div>
          </div>
        ) : (
          <DataTable rows={txs} columns={cols} pageSize={8} searchText={(t) => `${t.description} ${t.ref ?? ""}`} empty={{ title: "No transactions", description: "Earnings and payouts will appear here." }}
            filters={[
              { label: "Period", options: ["Last 30 days", "Last 90 days", "Last 180 days", "Year to date"], predicate: (t, v) => v === "Year to date" ? t.date.startsWith("2026") : within(t.date, v === "Last 30 days" ? 30 : v === "Last 90 days" ? 90 : 180) },
              { label: "Type", options: ["Earning", "Payout", "Reserved"], predicate: (t, v) => (v === "Earning" ? t.type === "credit" : v === "Payout" ? t.type === "payout" : t.type === "reserved") }
            ]} />
        )}
      </div>
    </>
  );
}
