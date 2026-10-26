"use client";
import { useState } from "react";
import { AlertTriangle, History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardHeader, Field, Input, PageHeader, Skeleton, Textarea } from "@/components/ui/primitives";
import { useUI } from "@/components/ui/overlays";
import { dateFmt, usd } from "@/lib/cn";
import { CATEGORIES, datasets, users } from "@/mock/data";
import { useFakeLoad } from "@/lib/demo";
import { ActorSwitch } from "./payout-flow";
import { currentVersion, today, useActor, usePricing, versionState, type PriceVersion } from "./store";

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4 py-2 text-sm"><dt className="text-muted">{k}</dt><dd className="font-medium tabular">{v}</dd></div>;
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

export function PricingPage() {
  const loading = useFakeLoad(450);
  const { actor } = useActor();
  const { toast, confirm } = useUI();
  const [versions, setVersions] = usePricing();
  const [editing, setEditing] = useState(false);
  const cur = currentVersion(versions);
  const canEdit = actor.role === "super_admin";
  const [f, setF] = useState<PriceVersion | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [effective, setEffective] = useState(tomorrow());

  const start = () => { setF({ ...cur, categories: [...cur.categories], rewards: cur.rewards.map((r) => ({ ...r })) }); setNote(""); setEffective(tomorrow()); setErrs({}); setEditing(true); };

  const validate = (v: PriceVersion) => {
    const e: Record<string, string> = {};
    if (!(v.raw > 0)) e.raw = "Must be greater than 0";
    if (!(v.labeled >= v.raw)) e.labeled = "Labeled rate must be at least the raw rate";
    if (!(v.minWithdrawal >= 1)) e.min = "Must be at least $1";
    if (!(v.maxUploadGb > 0)) e.gb = "Must be greater than 0";
    if (!(v.maxFileMb > 0)) e.mb = "Must be greater than 0";
    if (v.categories.length === 0) e.cat = "Select at least one category";
    if (v.rewards.some((r) => !(r.reward >= 0))) e.rewards = "Rewards cannot be negative";
    if (effective <= today()) e.eff = "Effective date must be in the future so no approved earnings are affected";
    if (note.trim().length < 10) e.note = "Describe the reason for this change (min 10 characters)";
    return e;
  };

  const pendingGb = datasets.filter((d) => ["pending_review", "processing", "uploading", "changes_requested", "partially_approved"].includes(d.status));
  const impact = (v: PriceVersion) => {
    const rawGb = pendingGb.filter((d) => d.kind === "raw").reduce((s, d) => s + d.sizeGb, 0);
    const labGb = pendingGb.filter((d) => d.kind === "labeled").reduce((s, d) => s + d.sizeGb, 0);
    return { rawGb, labGb, delta: rawGb * (v.raw - cur.raw) + labGb * (v.labeled - cur.labeled) };
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f) return;
    const er = validate(f); setErrs(er); if (Object.keys(er).length) return;
    const i = impact(f);
    const ok = await confirm({
      title: `Publish pricing v${Math.max(...versions.map((v) => v.version)) + 1}?`,
      description: `Effective ${dateFmt(effective)}. Raw ${usd(cur.raw)} → ${usd(f.raw)}/GB, labeled ${usd(cur.labeled)} → ${usd(f.labeled)}/GB, minimum withdrawal ${usd(cur.minWithdrawal)} → ${usd(f.minWithdrawal)}. Not retroactive: ${usd(users.reduce((s, u) => s + u.earnings, 0))} of already-approved earnings stays unchanged. Estimated effect on ${(i.rawGb + i.labGb).toFixed(1)} GB currently in the pipeline: ${i.delta >= 0 ? "+" : "-"}${usd(Math.abs(i.delta))} if approved after the effective date.`,
      confirmLabel: "Publish new version"
    });
    if (!ok) return;
    setVersions((p) => [{ ...f, id: `PV-${p.length + 1}`, version: Math.max(...p.map((v) => v.version)) + 1, effective, createdBy: actor.name, createdAt: today(), note: note.trim() }, ...p]);
    setEditing(false); toast("New pricing version scheduled. Existing earnings are unchanged.");
  };

  const set = <K extends keyof PriceVersion>(k: K, val: PriceVersion[K]) => setF((p) => (p ? { ...p, [k]: val } : p));
  const num = (s: string) => (s === "" ? NaN : Number(s));

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;
  const imp = f ? impact(f) : null;

  return (
    <div>
      <PageHeader title="Pricing" description="Earning rates, withdrawal limits and annotation rewards. Changes create a new effective-dated version." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Pricing" }]}
        actions={<><ActorSwitch />{canEdit && !editing && <Button onClick={start}><Plus size={14} aria-hidden />New price version</Button>}</>} />
      <div className="mb-4 space-y-3">
        <Alert tone="warning" title="Pricing changes are never retroactive">A new version only applies to data approved on or after its effective date. Earnings that were already approved keep the rate in force at the time of approval.</Alert>
        {!canEdit && <Alert tone="info" title="Read-only for administrators">Only a Super administrator can publish pricing versions. Use the demo switcher above to act as one.</Alert>}
      </div>

      {editing && f ? (
        <Card className="mb-6"><CardHeader title="Draft new version" description="History is never edited; this adds a new version." />
          <form onSubmit={save} className="space-y-6 p-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Raw rate (USD / accepted GB)" error={errs.raw} required>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.raw} type="number" step="0.01" value={Number.isNaN(f.raw) ? "" : f.raw} onChange={(e) => set("raw", num(e.target.value))} />}</Field>
              <Field label="Labeled rate (USD / accepted GB)" error={errs.labeled} required>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.labeled} type="number" step="0.01" value={Number.isNaN(f.labeled) ? "" : f.labeled} onChange={(e) => set("labeled", num(e.target.value))} />}</Field>
              <Field label="Minimum withdrawal (USD)" error={errs.min} required>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.min} type="number" value={Number.isNaN(f.minWithdrawal) ? "" : f.minWithdrawal} onChange={(e) => set("minWithdrawal", num(e.target.value))} />}</Field>
              <Field label="Max upload size (GB)" error={errs.gb} required>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.gb} type="number" value={Number.isNaN(f.maxUploadGb) ? "" : f.maxUploadGb} onChange={(e) => set("maxUploadGb", num(e.target.value))} />}</Field>
              <Field label="Max file size (MB)" error={errs.mb} required>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.mb} type="number" value={Number.isNaN(f.maxFileMb) ? "" : f.maxFileMb} onChange={(e) => set("maxFileMb", num(e.target.value))} />}</Field>
              <Field label="Effective date" error={errs.eff} required hint="Must be a future date">{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.eff} type="date" min={tomorrow()} value={effective} onChange={(e) => setEffective(e.target.value)} />}</Field>
            </div>
            <fieldset><legend className="mb-2 text-sm font-medium">Eligible categories</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm"><input type="checkbox" checked={f.categories.includes(c)} onChange={(e) => set("categories", e.target.checked ? [...f.categories, c] : f.categories.filter((x) => x !== c))} />{c}</label>))}</div>
              {errs.cat && <p role="alert" className="mt-1 text-xs text-danger">{errs.cat}</p>}</fieldset>
            <fieldset><legend className="mb-2 text-sm font-medium">Annotation task reward rules (USD / task)</legend>
              <div className="grid gap-3 sm:grid-cols-3">{f.rewards.map((r, i) => (
                <Field key={r.type} label={r.type}>{(id) => <Input id={id} type="number" step="0.01" value={Number.isNaN(r.reward) ? "" : r.reward} onChange={(e) => set("rewards", f.rewards.map((x, j) => (j === i ? { ...x, reward: num(e.target.value) } : x)))} />}</Field>))}</div>
              {errs.rewards && <p role="alert" className="mt-1 text-xs text-danger">{errs.rewards}</p>}</fieldset>
            <Field label="Reason for change" required error={errs.note}>{(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errs.note} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            {imp && <div className="flex gap-3 rounded-lg bg-surface2 p-4 text-sm"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden />
              <div><p className="font-medium">Impact preview</p><p className="text-muted">{imp.rawGb.toFixed(1)} GB raw and {imp.labGb.toFixed(1)} GB labeled are in the pipeline. Estimated change if approved after {dateFmt(effective)}: <b className="text-fg">{imp.delta >= 0 ? "+" : "-"}{usd(Math.abs(imp.delta))}</b>. Already-approved earnings: unchanged.</p></div></div>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit">Review &amp; publish</Button></div>
          </form></Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader title="Current rates" action={<Badge tone="success" dot>v{cur.version} in effect</Badge>} />
          <dl className="divide-y divide-line px-5 py-2"><Row k="Raw data" v={`${usd(cur.raw)} / accepted GB`} /><Row k="Labeled data" v={`${usd(cur.labeled)} / accepted GB`} /><Row k="Minimum withdrawal" v={usd(cur.minWithdrawal)} />
            <Row k="Max upload" v={`${cur.maxUploadGb} GB`} /><Row k="Max file size" v={`${cur.maxFileMb} MB`} /><Row k="Effective since" v={dateFmt(cur.effective)} /></dl></Card>
        <Card><CardHeader title="Annotation task rewards" /><dl className="divide-y divide-line px-5 py-2">{cur.rewards.map((r) => <Row key={r.type} k={r.type} v={`${usd(r.reward)} / task`} />)}</dl></Card>
        <Card><CardHeader title="Eligible categories" description={`${cur.categories.length} of ${CATEGORIES.length} enabled`} />
          <div className="flex flex-wrap gap-1.5 p-5">{CATEGORIES.map((c) => <Badge key={c} tone={cur.categories.includes(c) ? "brand" : "neutral"}>{c}</Badge>)}</div></Card>
      </div>

      <Card className="mt-4"><CardHeader title="Price schedule" description="Effective-dated, immutable history" action={<History size={16} className="text-muted" aria-hidden />} />
        <div className="scroll-thin overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-surface2/60 text-xs text-muted"><tr>{["Version", "Effective", "Raw", "Labeled", "Min withdrawal", "State", "Created by", "Note"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{[...versions].sort((a, b) => b.version - a.version).map((v) => { const s = versionState(v, versions); return (
            <tr key={v.id}><td className="px-4 py-3 font-medium">v{v.version}</td><td className="px-4 py-3">{dateFmt(v.effective)}</td><td className="tabular px-4 py-3">{usd(v.raw)}</td><td className="tabular px-4 py-3">{usd(v.labeled)}</td><td className="tabular px-4 py-3">{usd(v.minWithdrawal)}</td>
              <td className="px-4 py-3"><Badge tone={s === "current" ? "success" : s === "scheduled" ? "brand" : "neutral"} dot>{s}</Badge></td><td className="px-4 py-3">{v.createdBy}</td><td className="px-4 py-3 text-muted">{v.note}</td></tr>); })}</tbody>
        </table></div></Card>
    </div>
  );
}
