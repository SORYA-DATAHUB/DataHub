"use client";
import { BadgeCheck, CreditCard, Hourglass, Plus, ShieldCheck, Star, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal, Tabs, useUI } from "@/components/ui/overlays";
import { Alert, Avatar, Badge, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Skeleton, StatusBadge, Textarea } from "@/components/ui/primitives";
import { useDemoState, useFakeLoad, wait } from "@/lib/demo";
import { ME, maskAccount, type PayoutMethod } from "./data";
import { usePayoutMethods, useQueryParam, useVerification } from "./hooks";

const TABS = ["personal", "verification", "payout-methods"] as const;
type Profile = { name: string; phone: string; country: string; bio: string };
const PROFILE0: Profile = { name: ME.name, phone: "+855 12 345 678", country: "Cambodia", bio: "Archivist and volunteer digitising provincial records." };

export function Profile() {
  const loading = useFakeLoad(450);
  const [tabRaw, setTab] = useQueryParam("tab", "personal");
  const tab = (TABS as readonly string[]).includes(tabRaw) ? tabRaw : "personal";
  const [verification] = useVerification();
  return (
    <>
      <PageHeader title="Profile" description="Your identity, verification and where we send your money." />
      <Card className="mb-6 flex flex-wrap items-center gap-4 p-5">
        <Avatar name={ME.name} size={56} />
        <div className="min-w-0 flex-1"><p className="text-lg font-semibold">{ME.name}</p><p className="text-sm text-muted">{ME.email}</p></div>
        <StatusBadge status={verification} />
      </Card>
      <Tabs tabs={[{ id: "personal", label: "Personal info" }, { id: "verification", label: "Verification" }, { id: "payout-methods", label: "Payout methods" }]} value={tab as (typeof TABS)[number]} onChange={(t) => setTab(t)} />
      <div className="mt-6" role="tabpanel">
        {loading ? <Skeleton className="h-72" /> : tab === "personal" ? <Personal /> : tab === "verification" ? <Verify /> : <Methods />}
      </div>
    </>
  );
}

function Personal() {
  const { toast } = useUI();
  const [saved, setSaved] = useDemoState<Profile>("contrib:profile", PROFILE0);
  const [v, setV] = useState(saved);
  const [errs, setErrs] = useState<Partial<Record<keyof Profile, string>>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setV(saved), [saved]);
  const submit = async () => {
    const e: typeof errs = {};
    if (v.name.trim().length < 2) e.name = "Enter your full name.";
    if (!/^\+?[\d\s-]{8,16}$/.test(v.phone.trim())) e.phone = "Enter a valid phone number, for example +855 12 345 678.";
    if (v.bio.length > 300) e.bio = "Keep your bio under 300 characters.";
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true); await wait(600); setSaved(v); setBusy(false); toast("Profile saved.");
  };
  const set = (k: keyof Profile, val: string) => setV({ ...v, [k]: val });
  return (
    <Card>
      <CardHeader title="Personal information" />
      <form className="grid gap-4 p-5 sm:grid-cols-2" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Full name" required error={errs.name}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.name} value={v.name} onChange={(e) => set("name", e.target.value)} />}</Field>
        <Field label="Email" hint="Verified. Contact support to change it.">{(id, d) => <Input id={id} aria-describedby={d} value={ME.email} readOnly disabled />}</Field>
        <Field label="Phone" required error={errs.phone}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.phone} value={v.phone} onChange={(e) => set("phone", e.target.value)} />}</Field>
        <Field label="Country">{(id) => <Select id={id} value={v.country} onChange={(e) => set("country", e.target.value)}>{["Cambodia", "Thailand", "Vietnam", "Laos", "Other"].map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
        <div className="sm:col-span-2"><Field label="About you" error={errs.bio} hint={`${v.bio.length}/300`}>{(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errs.bio} value={v.bio} onChange={(e) => set("bio", e.target.value)} />}</Field></div>
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" loading={busy}>Save changes</Button><Button type="button" variant="outline" onClick={() => { setV(saved); setErrs({}); }}>Discard</Button></div>
      </form>
    </Card>
  );
}

function Verify() {
  const { toast } = useUI();
  const [status, setStatus] = useVerification();
  const [idType, setIdType] = useState("");
  const [idFile, setIdFile] = useState("");
  const [selfie, setSelfie] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!idType) e.type = "Choose a document type.";
    if (!idFile) e.id = "Attach a photo or scan of your document.";
    if (!selfie) e.selfie = "Attach a selfie holding your document.";
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true); await wait(900); setStatus("pending"); setBusy(false); toast("Verification submitted. Review usually takes 1 business day. Files stay on your device in this demo.", "info");
  };
  if (status === "verified") return (
    <Card><EmptyState icon={BadgeCheck} title="You are verified" description="You can request withdrawals once you have at least $25 available." action={<div className="flex gap-2"><Button href="/withdrawals">Go to withdrawals</Button><Button variant="ghost" onClick={() => { setStatus("unverified"); toast("Demo: account reset to unverified.", "info"); }}>Demo: reset to unverified</Button></div>} /></Card>
  );
  if (status === "pending") return (
    <Card><EmptyState icon={Hourglass} title="Verification in review" description="A DataHub administrator is reviewing your documents. You can keep uploading in the meantime." action={<div className="flex gap-2"><Button onClick={() => { setStatus("verified"); toast("Demo: verification approved."); }}>Demo: simulate approval</Button><Button variant="outline" onClick={() => { setStatus("unverified"); setIdFile(""); setSelfie(""); }}>Withdraw submission</Button></div>} /></Card>
  );
  return (
    <Card>
      <CardHeader title="Verify your identity" description="Required before your first withdrawal. You can upload data and earn while waiting." />
      <form className="space-y-4 p-5" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Alert tone="info" title="Why we ask">We verify that payouts go to the person who owns the data. Documents are only used for verification.</Alert>
        <Field label="Document type" required error={errs.type}>{(id, d) => <Select id={id} aria-describedby={d} aria-invalid={!!errs.type} value={idType} onChange={(e) => setIdType(e.target.value)}><option value="">Select</option><option>National ID card</option><option>Passport</option><option>Driver licence</option></Select>}</Field>
        <FilePick label="Document photo or scan" name={idFile} error={errs.id} onPick={setIdFile} />
        <FilePick label="Selfie holding your document" name={selfie} error={errs.selfie} onPick={setSelfie} />
        <Button type="submit" loading={busy}><ShieldCheck size={14} />Submit for verification</Button>
      </form>
    </Card>
  );
}

function FilePick({ label, name, error, onPick }: { label: string; name: string; error?: string; onPick: (n: string) => void }) {
  return (
    <Field label={label} required error={error} hint="JPG, PNG or PDF up to 10 MB. Not uploaded in demo mode.">{(id, d) => (
      <div className="flex items-center gap-3"><label htmlFor={id} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm hover:bg-surface2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand"><Upload size={14} />Choose file
        <input id={id} aria-describedby={d} type="file" accept=".jpg,.jpeg,.png,.pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f.name); }} /></label>
        <span className="truncate text-sm text-muted">{name || "No file chosen"}</span></div>)}</Field>
  );
}

function Methods() {
  const { toast, confirm } = useUI();
  const [methods, setMethods] = usePayoutMethods();
  const [edit, setEdit] = useState<PayoutMethod | "new" | null>(null);
  return (
    <>
      <Card>
        <CardHeader title="Payout methods" description="Withdrawals are sent to one of these. The account name must match your verified identity." action={<Button size="sm" onClick={() => setEdit("new")}><Plus size={14} />Add method</Button>} />
        {methods.length === 0 ? <EmptyState icon={CreditCard} title="No payout methods" description="Add Wing, ABA Bank or PayPal to request withdrawals." action={<Button onClick={() => setEdit("new")}>Add method</Button>} /> : (
          <ul className="divide-y divide-line">{methods.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface2 text-muted"><CreditCard size={17} /></span>
              <div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-sm font-medium">{m.type} <span className="font-normal text-muted">{maskAccount(m.account)}</span>{m.isDefault && <Badge tone="brand"><Star size={10} aria-hidden />Default</Badge>}</p><p className="text-xs text-muted">{m.label}</p></div>
              <div className="flex gap-1">
                {!m.isDefault && <Button size="sm" variant="ghost" onClick={() => { setMethods((p) => p.map((x) => ({ ...x, isDefault: x.id === m.id }))); toast(`${m.label} is now your default.`); }}>Make default</Button>}
                <Button size="sm" variant="outline" onClick={() => setEdit(m)}>Edit</Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={async () => {
                  if (!(await confirm({ title: "Remove payout method?", description: `${m.type} ${maskAccount(m.account)} will be removed. Open withdrawals to it are not affected.`, confirmLabel: "Remove", danger: true }))) return;
                  setMethods((p) => { const r = p.filter((x) => x.id !== m.id); return r.length && !r.some((x) => x.isDefault) ? r.map((x, i) => ({ ...x, isDefault: i === 0 })) : r; }); toast("Payout method removed.");
                }}>Remove</Button>
              </div>
            </li>))}</ul>)}
      </Card>
      <MethodDialog target={edit} onClose={() => setEdit(null)} onSave={(m) => {
        setMethods((p) => (p.some((x) => x.id === m.id) ? p.map((x) => (x.id === m.id ? m : x)) : [...p, { ...m, isDefault: p.length === 0 }]));
        setEdit(null); toast(edit === "new" ? "Payout method added." : "Payout method updated.");
      }} />
    </>
  );
}

function MethodDialog({ target, onClose, onSave }: { target: PayoutMethod | "new" | null; onClose: () => void; onSave: (m: PayoutMethod) => void }) {
  const [type, setType] = useState<PayoutMethod["type"]>("Wing");
  const [label, setLabel] = useState("");
  const [account, setAccount] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!target) return;
    const m = target === "new" ? null : target;
    setType(m?.type ?? "Wing"); setLabel(m?.label ?? ""); setAccount(m?.account ?? ""); setErrs({});
  }, [target]);
  const save = () => {
    const e: Record<string, string> = {};
    if (label.trim().length < 2) e.label = "Give this method a name.";
    if (type === "PayPal" ? !/^\S+@\S+\.\S+$/.test(account) : account.replace(/\s/g, "").length < 8 || !/^[\d\s]+$/.test(account)) e.account = type === "PayPal" ? "Enter your PayPal email address." : "Enter 8 or more digits.";
    setErrs(e); if (Object.keys(e).length) return;
    onSave({ id: target && target !== "new" ? target.id : `pm-${Date.now()}`, type, label: label.trim(), account: account.trim(), isDefault: target && target !== "new" ? target.isDefault : false });
  };
  return (
    <Modal open={!!target} onClose={onClose} title={target === "new" ? "Add payout method" : "Edit payout method"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Type" required>{(id) => <Select id={id} value={type} onChange={(e) => setType(e.target.value as PayoutMethod["type"])}><option>Wing</option><option>ABA Bank</option><option>PayPal</option></Select>}</Field>
        <Field label="Name" required error={errs.label} hint="For example: Wing personal">{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.label} value={label} onChange={(e) => setLabel(e.target.value)} />}</Field>
        <Field label={type === "PayPal" ? "PayPal email" : "Account or phone number"} required error={errs.account}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.account} value={account} onChange={(e) => setAccount(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}
