"use client";
import { Banknote, BookOpenCheck, Clock, Database, HardDrive, ListChecks, ShieldCheck, Users, UserCheck, Wallet, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Bars, AreaTrend, Donut, LineTrend } from "@/components/ui/charts";
import { Button } from "@/components/ui/button";
import { Avatar, Card, CardHeader, PageHeader, Stat, StatusBadge } from "@/components/ui/primitives";
import { CATEGORIES, datasets, payouts, tasks, users } from "@/mock/data";
import { Loadable } from "./common";
import { adminActivity, fmtDate, gb, growth, reviews, spending, usd, verificationsSeed } from "./data";

const activity = [{ d: "Mon", active: 34 }, { d: "Tue", active: 41 }, { d: "Wed", active: 38 }, { d: "Thu", active: 52 }, { d: "Fri", active: 47 }, { d: "Sat", active: 21 }, { d: "Sun", active: 18 }];

export function AdminOverview() {
  const pendingVer = verificationsSeed.filter((v) => v.status === "pending").length;
  const pendingReviews = reviews.filter((r) => r.status !== "completed").length;
  const uploaded = datasets.reduce((a, d) => a + d.sizeGb, 0);
  const rawAcc = datasets.filter((d) => d.kind === "raw").reduce((a, d) => a + d.acceptedGb, 0);
  const labAcc = datasets.filter((d) => d.kind === "labeled").reduce((a, d) => a + d.acceptedGb, 0);
  const approvedEarn = users.reduce((a, u) => a + u.earnings, 0);
  const pendingPayout = payouts.filter((p) => ["requested", "under_review", "approved"].includes(p.status)).reduce((a, p) => a + p.amount, 0);
  const paid = payouts.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const cat = CATEGORIES.map((c) => ({ name: c, value: datasets.filter((d) => d.category === c).length })).filter((c) => c.value > 0);
  const statusData = ["pending_review", "approved", "partially_approved", "changes_requested", "rejected"].map((s) => ({ name: s.replace(/_/g, " "), value: datasets.filter((d) => d.status === s).length })).filter((s) => s.value > 0);
  const recent = [...datasets].sort((a, b) => b.uploaded.localeCompare(a.uploaded)).slice(0, 5);

  return (
    <Loadable>
      <PageHeader title="Admin overview" description="Operations at a glance. All figures are simulated demo data."
        actions={<><Button variant="outline" href="/admin/analytics">View analytics</Button><Button href="/admin/reviews">Review queue</Button></>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total users" value={users.length} icon={Users} hint="+3 this week" />
        <Stat label="Active contributors" value={users.filter((u) => u.roles.includes("Contributor") && u.status === "active").length} icon={UserCheck} tone="success" />
        <Stat label="Pending verifications" value={pendingVer} icon={ShieldCheck} tone="warning" hint={<Link href="/admin/verifications" className="text-brand hover:underline">Open queue</Link>} />
        <Stat label="Pending reviews" value={pendingReviews} icon={BookOpenCheck} tone="warning" hint={<Link href="/admin/reviews" className="text-brand hover:underline">Open queue</Link>} />
        <Stat label="Uploaded" value={gb(uploaded)} icon={HardDrive} />
        <Stat label="Accepted raw" value={gb(rawAcc)} icon={Database} tone="success" hint="$1.00 per accepted GB" />
        <Stat label="Accepted labeled" value={gb(labAcc)} icon={CheckCircle2} tone="success" hint="$1.50 per accepted GB" />
        <Stat label="Tasks in progress" value={inProgress} icon={ListChecks} />
        <Stat label="Approved earnings" value={usd(approvedEarn)} icon={Banknote} tone="success" />
        <Stat label="Pending payout" value={usd(pendingPayout)} icon={Clock} tone="warning" hint={<Link href="/admin/payouts" className="text-brand hover:underline">Manual approval</Link>} />
        <Stat label="Paid out" value={usd(paid)} icon={Wallet} tone="success" />
        <Stat label="Datasets" value={datasets.length} icon={Database} hint={<Link href="/admin/datasets" className="text-brand hover:underline">Explore all</Link>} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Dataset growth" description="Datasets and GB uploaded per month" /><div className="p-4"><AreaTrend data={growth} x="m" series={["datasets", "gb"]} /></div></Card>
        <Card><CardHeader title="Spending trends" description="USD by earning type" /><div className="p-4"><Bars data={spending} x="m" series={["raw", "labeled", "annotation"]} stacked /></div></Card>
        <Card><CardHeader title="Category distribution" /><div className="p-4"><Donut data={cat} /></div></Card>
        <Card><CardHeader title="Review status breakdown" /><div className="p-4"><Donut data={statusData} /></div></Card>
        <Card className="lg:col-span-2"><CardHeader title="Contributor activity" description="Active contributors, last 7 days" /><div className="p-4"><LineTrend data={activity} x="d" series={["active"]} height={200} /></div></Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent datasets" action={<Button variant="ghost" size="sm" href="/admin/datasets">View all</Button>} />
          <ul className="divide-y divide-line">
            {recent.map((d) => (
              <li key={d.id}><Link href={`/admin/datasets/${d.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface2/50">
                <Avatar name={d.owner} size={28} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.title}</p><p className="text-xs text-muted">{d.id} · {gb(d.sizeGb)} · {fmtDate(d.uploaded)}</p></div>
                <StatusBadge status={d.status} />
              </Link></li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Recent admin activity" action={<Button variant="ghost" size="sm" href="/admin/audit-logs">Audit logs</Button>} />
          <ul className="divide-y divide-line">
            {adminActivity.map((a) => (
              <li key={a.id}><Link href={a.href} className="flex items-center gap-3 px-5 py-3 hover:bg-surface2/50">
                <Avatar name={a.actor} size={28} />
                <p className="min-w-0 flex-1 text-sm"><span className="font-medium">{a.actor}</span> <span className="text-muted">{a.text}</span></p>
                <span className="shrink-0 text-xs text-muted">{a.time}</span>
              </Link></li>
            ))}
          </ul>
        </Card>
      </div>
    </Loadable>
  );
}
