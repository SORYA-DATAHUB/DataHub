"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, useUI } from "@/components/ui/overlays";
import { Alert, Card, CardHeader, Field, Input, PageHeader, Select, Switch } from "@/components/ui/primitives";
import { useDemoState } from "@/lib/demo";
import { Loadable, useQueryParam } from "./common";
import { PERMISSIONS, ROLE_MATRIX, ROLES, settingsDefaults, type Settings } from "./data";

const TABS = ["general", "uploads", "finance", "annotation", "roles"] as const;
type Tab = (typeof TABS)[number];
type Matrix = Record<string, string[]>;
type Store = { s: Settings; matrix: Matrix };
const defaults: Store = { s: settingsDefaults, matrix: ROLE_MATRIX };

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-medium">{label}</p>{hint && <p className="text-xs text-muted">{hint}</p>}</div>{children}</div>;
}

function validate(d: Store) {
  const e: Record<string, string> = {};
  if (!/^\S+@\S+\.\S+$/.test(d.s.general.supportEmail)) e.supportEmail = "Enter a valid email address.";
  if (d.s.general.platformName.trim().length < 2) e.platformName = "Name is required.";
  if (!(d.s.uploads.maxSizeGb >= 1 && d.s.uploads.maxSizeGb <= 500)) e.maxSizeGb = "Use a value between 1 and 500 GB.";
  if (!(d.s.uploads.maxFiles >= 1)) e.maxFiles = "Must be at least 1.";
  if (!Object.values(d.s.uploads.types).some(Boolean)) e.types = "Enable at least one file type.";
  if (!(d.s.finance.minWithdrawal >= 1)) e.minWithdrawal = "Must be at least $1.";
  if (!(d.s.annotation.maxTasksPerAnnotator >= 1)) e.maxTasks = "Must be at least 1.";
  if (!(d.s.annotation.defaultReviewSample >= 1 && d.s.annotation.defaultReviewSample <= 100)) e.sample = "Use 1 to 100 percent.";
  return e;
}

export function AdminSettings() {
  const { toast, confirm } = useUI();
  const [tabRaw, setTab] = useQueryParam("tab", "general");
  const tab = (TABS as readonly string[]).includes(tabRaw) ? (tabRaw as Tab) : "general";
  const [saved, setSaved] = useDemoState<Store>("admin-settings", defaults);
  const [draft, setDraft] = useState<Store | null>(null);
  const cur = draft ?? saved;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const errors = validate(cur);
  const errCount = Object.keys(errors).length;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const edit = (fn: (d: Store) => Store) => setDraft((d) => fn(structuredClone(d ?? saved)));
  const s = cur.s;
  const num = (v: string) => (v === "" ? 0 : Number(v));

  const save = async () => {
    if (errCount) { toast(`Fix ${errCount} validation error${errCount > 1 ? "s" : ""} before saving.`, "error"); return; }
    if (cur.s.general.maintenance && !saved.s.general.maintenance && !(await confirm({ title: "Enable maintenance mode?", description: "Everyone except super administrators will see the maintenance page (simulated).", confirmLabel: "Enable", danger: true }))) return;
    setSaved(cur); setDraft(null); toast("Settings saved (demo).");
  };

  return (
    <Loadable role="Super Administrator">
      <PageHeader title="System settings" description="Platform configuration. Changes apply to the demo only." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Settings" }]}
        actions={<Button variant="ghost" onClick={async () => { if (await confirm({ title: "Reset all settings?", description: "Restores factory defaults for this demo.", confirmLabel: "Reset", danger: true })) { setSaved(defaults); setDraft(null); toast("Settings reset to defaults.", "info"); } }}>Reset to defaults</Button>} />
      <Tabs tabs={TABS.map((t) => ({ id: t, label: t[0].toUpperCase() + t.slice(1) }))} value={tab} onChange={setTab} />
      <div className="mt-5 max-w-3xl space-y-4 pb-24" role="tabpanel">
        {tab === "general" && <>
          <Card><CardHeader title="Platform" /><div className="space-y-4 p-5">
            <Field label="Platform name" error={errors.platformName}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.platformName} value={s.general.platformName} onChange={(e) => edit((x) => { x.s.general.platformName = e.target.value; return x; })} />}</Field>
            <Field label="Support email" error={errors.supportEmail}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.supportEmail} value={s.general.supportEmail} onChange={(e) => edit((x) => { x.s.general.supportEmail = e.target.value; return x; })} />}</Field>
            <Field label="Default language">{(id) => <Select id={id} value={s.general.defaultLanguage} onChange={(e) => edit((x) => { x.s.general.defaultLanguage = e.target.value; return x; })}><option>English</option><option>Khmer</option></Select>}</Field>
            <Row label="Maintenance mode" hint="Shows the maintenance page to everyone except super administrators."><Switch label="Maintenance mode" checked={s.general.maintenance} onChange={(v) => edit((x) => { x.s.general.maintenance = v; return x; })} /></Row>
          </div></Card>
          <Card><CardHeader title="Security and review" /><div className="divide-y divide-line px-5">
            <Row label="Require MFA for admins"><Switch label="Require MFA for admins" checked={s.security.mfaRequiredAdmins} onChange={(v) => edit((x) => { x.s.security.mfaRequiredAdmins = v; return x; })} /></Row>
            <Row label="Notify on new device sign-in"><Switch label="Notify on new device" checked={s.security.notifyNewDevice} onChange={(v) => edit((x) => { x.s.security.notifyNewDevice = v; return x; })} /></Row>
            <Row label="Session length" hint="Hours before re-authentication"><Select aria-label="Session length" className="w-28" value={s.security.sessionHours} onChange={(e) => edit((x) => { x.s.security.sessionHours = Number(e.target.value); return x; })}>{[4, 8, 12, 24].map((h) => <option key={h} value={h}>{h} hours</option>)}</Select></Row>
            <Row label="Review SLA" hint="Days before a submitted dataset is flagged late"><Select aria-label="Review SLA" className="w-28" value={s.security.reviewSla} onChange={(e) => edit((x) => { x.s.security.reviewSla = Number(e.target.value); return x; })}>{[1, 3, 5, 7].map((h) => <option key={h} value={h}>{h} days</option>)}</Select></Row>
            <Row label="Notify contributors on payout events"><Switch label="Notify on payout events" checked={s.finance.notifyOnPayout} onChange={(v) => edit((x) => { x.s.finance.notifyOnPayout = v; return x; })} /></Row>
          </div></Card></>}
        {tab === "uploads" && <>
          <Card><CardHeader title="Supported file types" description="Contributors can only upload enabled types." /><div className="p-5">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{Object.keys(s.uploads.types).map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface2"><input type="checkbox" checked={s.uploads.types[t]} onChange={(e) => edit((x) => { x.s.uploads.types[t] = e.target.checked; return x; })} />{t}</label>))}</div>
            {errors.types && <p role="alert" className="mt-2 text-xs text-danger">{errors.types}</p>}</div></Card>
          <Card><CardHeader title="Limits and storage" /><div className="space-y-4 p-5">
            <Field label="Max dataset size (GB)" error={errors.maxSizeGb}>{(id, d) => <Input id={id} type="number" aria-describedby={d} aria-invalid={!!errors.maxSizeGb} value={s.uploads.maxSizeGb} onChange={(e) => edit((x) => { x.s.uploads.maxSizeGb = num(e.target.value); return x; })} />}</Field>
            <Field label="Max files per dataset" error={errors.maxFiles}>{(id, d) => <Input id={id} type="number" aria-describedby={d} aria-invalid={!!errors.maxFiles} value={s.uploads.maxFiles} onChange={(e) => edit((x) => { x.s.uploads.maxFiles = num(e.target.value); return x; })} />}</Field>
            <Field label="Retention of rejected data (days)">{(id) => <Input id={id} type="number" value={s.uploads.retentionDays} onChange={(e) => edit((x) => { x.s.uploads.retentionDays = num(e.target.value); return x; })} />}</Field>
            <Row label="Virus scan on upload"><Switch label="Virus scan" checked={s.uploads.virusScan} onChange={(v) => edit((x) => { x.s.uploads.virusScan = v; return x; })} /></Row>
            <Row label="Duplicate detection" hint="Duplicate data is never eligible for payment."><Switch label="Duplicate detection" checked={s.uploads.dedupe} onChange={(v) => edit((x) => { x.s.uploads.dedupe = v; return x; })} /></Row>
          </div></Card></>}
        {tab === "finance" && <>
          <Alert tone="info" title="Rates are managed in Pricing">Raw data pays ${s.finance.rateRaw.toFixed(2)} and labeled data ${s.finance.rateLabeled.toFixed(2)} per accepted GB. Change them as versioned rules on the <Link href="/admin/pricing" className="font-medium underline">Pricing page</Link>.</Alert>
          <Card><CardHeader title="Payouts" /><div className="space-y-4 p-5">
            <Field label="Minimum withdrawal (USD)" error={errors.minWithdrawal}>{(id, d) => <Input id={id} type="number" aria-describedby={d} aria-invalid={!!errors.minWithdrawal} value={s.finance.minWithdrawal} onChange={(e) => edit((x) => { x.s.finance.minWithdrawal = num(e.target.value); return x; })} />}</Field>
            <Row label="Manual payout approval" hint="Required by policy. Cannot be disabled."><Switch label="Manual payout approval" checked onChange={() => toast("Manual payout approval is required and cannot be disabled.", "info")} /></Row>
            <div><p className="mb-2 text-sm font-medium">Payout methods</p><div className="grid gap-2 sm:grid-cols-3">{Object.keys(s.finance.payoutMethods).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface2"><input type="checkbox" checked={s.finance.payoutMethods[m]} onChange={(e) => edit((x) => { x.s.finance.payoutMethods[m] = e.target.checked; return x; })} />{m}</label>))}</div></div>
          </div></Card></>}
        {tab === "annotation" && (
          <Card><CardHeader title="Annotation defaults" /><div className="space-y-4 p-5">
            <Field label="Review sample (percent of tasks)" error={errors.sample}>{(id, d) => <Input id={id} type="number" aria-describedby={d} aria-invalid={!!errors.sample} value={s.annotation.defaultReviewSample} onChange={(e) => edit((x) => { x.s.annotation.defaultReviewSample = num(e.target.value); return x; })} />}</Field>
            <Field label="Max concurrent tasks per annotator" error={errors.maxTasks}>{(id, d) => <Input id={id} type="number" aria-describedby={d} aria-invalid={!!errors.maxTasks} value={s.annotation.maxTasksPerAnnotator} onChange={(e) => edit((x) => { x.s.annotation.maxTasksPerAnnotator = num(e.target.value); return x; })} />}</Field>
            <Field label="Default deadline (days)">{(id) => <Input id={id} type="number" value={s.annotation.deadlineDays} onChange={(e) => edit((x) => { x.s.annotation.deadlineDays = num(e.target.value); return x; })} />}</Field>
            <Row label="Reviewer required before payout"><Switch label="Reviewer required" checked={s.annotation.reviewerRequired} onChange={(v) => edit((x) => { x.s.annotation.reviewerRequired = v; return x; })} /></Row>
            <Row label="Auto-assign tasks"><Switch label="Auto-assign tasks" checked={s.annotation.autoAssign} onChange={(v) => edit((x) => { x.s.annotation.autoAssign = v; return x; })} /></Row>
          </div></Card>)}
        {tab === "roles" && (
          <Card><CardHeader title="Role management matrix" description="Super Administrator always holds every permission." />
            <div className="scroll-thin overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface2/60 text-xs text-muted"><tr><th className="px-4 py-2.5 text-left font-medium">Permission</th>{ROLES.map((r) => <th key={r} className="px-3 py-2.5 text-center font-medium">{r}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">{PERMISSIONS.map((p) => (
                <tr key={p}><td className="px-4 py-2.5">{p}</td>{ROLES.map((r) => (
                  <td key={r} className="px-3 py-2.5 text-center"><input type="checkbox" aria-label={`${r} can ${p}`} disabled={r === "Super Administrator"} checked={cur.matrix[r]?.includes(p) ?? false}
                    onChange={(e) => edit((x) => { const l = new Set(x.matrix[r] ?? []); if (e.target.checked) l.add(p); else l.delete(p); x.matrix[r] = [...l]; return x; })} /></td>))}</tr>))}</tbody></table></div>
          </Card>)}
      </div>
      {dirty && (
        <div role="region" aria-label="Unsaved changes" className="pop fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur lg:left-[248px]">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 lg:px-4">
            <p className="flex-1 text-sm font-medium">You have unsaved changes{errCount > 0 && <span className="ml-2 text-danger">({errCount} to fix)</span>}</p>
            <Button variant="outline" onClick={() => { setDraft(null); toast("Changes discarded.", "info"); }}>Discard</Button>
            <Button onClick={save}>Save changes</Button>
          </div>
        </div>)}
    </Loadable>
  );
}
