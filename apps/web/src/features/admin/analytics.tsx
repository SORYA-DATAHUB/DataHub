"use client";
import { Download } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { AreaTrend, Bars, Donut, LineTrend } from "@/components/ui/charts";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/ui/overlays";
import { Avatar, Card, CardHeader, EmptyState, Field, Input, PageHeader, Stat } from "@/components/ui/primitives";
import { CATEGORIES, datasets, monthly } from "@/mock/data";
import { Loadable, useQueryParam, useSetQuery } from "./common";
import { gb, growth, newContributors, quality, reviewTime, spending, throughput, usd } from "./data";
import { useUsers } from "./state";

const MONTHS = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const monthNo = (m: string) => 5 + MONTHS.indexOf(m);

export function AdminAnalytics() {
  const { toast } = useUI();
  const { users } = useUsers();
  const setQuery = useSetQuery();
  const [from] = useQueryParam("from", "2026-05-01");
  const [to] = useQueryParam("to", "2026-10-31");
  const invalid = from > to;
  const inRange = useMemo(() => (m: string) => { const n = monthNo(m); const f = Number(from.slice(5, 7)), t = Number(to.slice(5, 7)); return n >= f && n <= t; }, [from, to]);
  const f = <T extends { m: string }>(rows: T[]) => (invalid ? [] : rows.filter((r) => inRange(r.m)));

  const sp = f(spending), gr = f(growth), mo = f(monthly);
  const cat = CATEGORIES.map((c) => ({ name: c, value: datasets.filter((d) => d.category === c).length })).filter((c) => c.value > 0);
  const totalSpend = sp.reduce((a, s) => a + s.raw + s.labeled + s.annotation, 0);
  const rank = [...users].filter((u) => u.acceptedGb > 0).sort((a, b) => b.acceptedGb - a.acceptedGb).slice(0, 5);
  const uploads = mo.reduce((a, m) => a + m.uploaded, 0), accepted = mo.reduce((a, m) => a + m.accepted, 0);
  const preset = (months: number) => setQuery({ from: `2026-${String(Math.max(5, 11 - months)).padStart(2, "0")}-01`, to: "2026-10-31" });

  return (
    <Loadable>
      <PageHeader title="Analytics" description="Platform performance over the selected period (demo data, May to Oct 2026)." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Analytics" }]}
        actions={<Button variant="outline" onClick={() => toast("CSV export simulated. No file is generated in demo mode.", "info")}><Download size={14} />Export CSV</Button>} />
      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="From">{(id) => <Input id={id} type="date" value={from} min="2026-05-01" max="2026-10-31" onChange={(e) => setQuery({ from: e.target.value || null })} />}</Field>
        <Field label="To" error={invalid ? "End date must be after the start date." : undefined}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={invalid} type="date" value={to} min="2026-05-01" max="2026-10-31" onChange={(e) => setQuery({ to: e.target.value || null })} />}</Field>
        <div className="flex gap-2"><Button variant="outline" onClick={() => preset(3)}>Last 3 months</Button><Button variant="outline" onClick={() => preset(6)}>Last 6 months</Button><Button variant="ghost" onClick={() => setQuery({ from: null, to: null })}>Reset</Button></div>
      </Card>
      {sp.length === 0 ? <Card><EmptyState title="No data in this range" description={invalid ? "Fix the date range to see analytics." : "Pick dates between May and October 2026."} action={<Button variant="outline" onClick={() => setQuery({ from: null, to: null })}>Reset range</Button>} /></Card> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Uploaded" value={`${uploads} sets`} /><Stat label="Accepted" value={`${accepted} sets`} tone="success" hint={`${uploads ? Math.round((accepted / uploads) * 100) : 0}% acceptance`} />
            <Stat label="GB uploaded" value={gb(gr.reduce((a, g) => a + g.gb, 0))} /><Stat label="Total spend" value={usd(totalSpend)} tone="warning" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader title="New contributors" /><div className="p-4"><Bars data={f(newContributors)} x="m" series={["users"]} /></div></Card>
            <Card><CardHeader title="Upload volume (GB)" /><div className="p-4"><AreaTrend data={gr} x="m" series={["gb"]} /></div></Card>
            <Card><CardHeader title="Accepted vs rejected datasets" /><div className="p-4"><Bars data={mo.map((m) => ({ m: m.m, accepted: m.accepted, rejected: m.uploaded - m.accepted }))} x="m" series={["accepted", "rejected"]} stacked /></div></Card>
            <Card><CardHeader title="By category" /><div className="p-4"><Donut data={cat} /></div></Card>
            <Card><CardHeader title="Average review time (hours)" /><div className="p-4"><LineTrend data={f(reviewTime)} x="m" series={["hours"]} /></div></Card>
            <Card><CardHeader title="Spending by type" description="Raw $1.00/GB, labeled $1.50/GB, annotation" /><div className="p-4"><Bars data={sp} x="m" series={["raw", "labeled", "annotation"]} stacked /></div></Card>
            <Card><CardHeader title="Annotation throughput (tasks)" /><div className="p-4"><Bars data={f(throughput)} x="m" series={["tasks"]} /></div></Card>
            <Card><CardHeader title="Quality trend (avg score)" /><div className="p-4"><LineTrend data={f(quality)} x="m" series={["score"]} /></div></Card>
            <Card><CardHeader title="Monthly spend (USD)" /><div className="p-4"><AreaTrend money data={sp.map((s) => ({ m: s.m, total: s.raw + s.labeled + s.annotation }))} x="m" series={["total"]} /></div></Card>
            <Card><CardHeader title="Contributor ranking" description="By accepted GB" />
              <ol className="divide-y divide-line">{rank.map((u, i) => (<li key={u.id} className="flex items-center gap-3 px-5 py-3 text-sm"><span className="w-4 text-xs text-muted">{i + 1}</span><Avatar name={u.name} size={28} /><Link href={`/admin/users/${u.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand">{u.name}</Link><span className="tabular text-muted">{gb(u.acceptedGb)}</span><span className="tabular w-16 text-right">{usd(u.earnings)}</span></li>))}</ol></Card>
          </div>
        </>
      )}
    </Loadable>
  );
}
