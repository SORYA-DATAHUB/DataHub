"use client";
import { Laptop, Monitor, Moon, ShieldCheck, Smartphone, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal, Tabs, useUI } from "@/components/ui/overlays";
import { Alert, Badge, Card, CardHeader, Field, Input, PageHeader, Skeleton, Switch } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useDemoState, useFakeLoad, wait } from "@/lib/demo";
import { useQueryParam } from "./hooks";

const TABS = ["security", "notifications", "appearance", "accessibility", "privacy"] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = { security: "Security", notifications: "Notifications", appearance: "Appearance", accessibility: "Accessibility", privacy: "Privacy" };

export function Settings() {
  const loading = useFakeLoad(450);
  const [raw, setTab] = useQueryParam("tab", "security");
  const tab: Tab = (TABS as readonly string[]).includes(raw) ? (raw as Tab) : "security";
  return (
    <>
      <PageHeader title="Settings" description="Security, notifications and how DataHub looks and feels. Preferences are saved in this browser for the demo." />
      <Tabs tabs={TABS.map((t) => ({ id: t, label: LABEL[t] }))} value={tab} onChange={(t) => setTab(t)} />
      <div className="mt-6" role="tabpanel">
        {loading ? <Skeleton className="h-72" /> : tab === "security" ? <Security /> : tab === "notifications" ? <Notify /> : tab === "appearance" ? <Appearance /> : tab === "accessibility" ? <A11y /> : <Privacy />}
      </div>
    </>
  );
}

const rules = (p: string) => [["At least 10 characters", p.length >= 10], ["An uppercase letter", /[A-Z]/.test(p)], ["A number", /\d/.test(p)], ["A symbol", /[^A-Za-z0-9]/.test(p)]] as const;
type Session = { id: string; device: string; place: string; last: string; current?: boolean; mobile?: boolean };
const SESSIONS: Session[] = [
  { id: "s1", device: "Chrome on Linux", place: "Phnom Penh, Cambodia", last: "Active now", current: true },
  { id: "s2", device: "Safari on iPhone", place: "Phnom Penh, Cambodia", last: "2 hours ago", mobile: true },
  { id: "s3", device: "Firefox on Windows", place: "Siem Reap, Cambodia", last: "5 days ago" }
];

function Security() {
  const { toast, confirm } = useUI();
  const [cur, setCur] = useState(""); const [np, setNp] = useState(""); const [cf, setCf] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useDemoState<boolean>("contrib:mfa", false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [code, setCode] = useState(""); const [codeErr, setCodeErr] = useState("");
  const [sessions, setSessions] = useDemoState<Session[]>("contrib:sessions", SESSIONS);
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!cur) e.cur = "Enter your current password.";
    if (rules(np).some(([, ok]) => !ok)) e.np = "Your new password does not meet all requirements below.";
    if (np && np === cur) e.np = "Choose a password different from your current one.";
    if (cf !== np) e.cf = "Passwords do not match.";
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true); await wait(800); setBusy(false); setCur(""); setNp(""); setCf(""); toast("Password changed (simulated). Other sessions would be signed out.");
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Change password" />
        <form className="grid max-w-xl gap-4 p-5" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="Current password" required error={errs.cur}>{(id, d) => <Input id={id} type="password" autoComplete="current-password" aria-describedby={d} aria-invalid={!!errs.cur} value={cur} onChange={(e) => setCur(e.target.value)} />}</Field>
          <Field label="New password" required error={errs.np}>{(id, d) => <Input id={id} type="password" autoComplete="new-password" aria-describedby={d} aria-invalid={!!errs.np} value={np} onChange={(e) => setNp(e.target.value)} />}</Field>
          <ul className="grid gap-1 text-xs sm:grid-cols-2" aria-label="Password requirements">{rules(np).map(([t, ok]) => <li key={t} className={ok ? "text-success" : "text-muted"}>{ok ? "✓" : "○"} {t}</li>)}</ul>
          <Field label="Confirm new password" required error={errs.cf}>{(id, d) => <Input id={id} type="password" autoComplete="new-password" aria-describedby={d} aria-invalid={!!errs.cf} value={cf} onChange={(e) => setCf(e.target.value)} />}</Field>
          <div><Button type="submit" loading={busy}>Update password</Button></div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Two-factor authentication" description="Adds a second step when you sign in." action={<Badge tone={mfa ? "success" : "neutral"} dot>{mfa ? "Enabled" : "Not enabled"}</Badge>} />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="flex items-center gap-2 text-sm text-muted"><ShieldCheck size={16} aria-hidden />Use an authenticator app. Recommended before your first withdrawal.</p>
          {mfa ? <Button variant="outline" onClick={async () => { if (await confirm({ title: "Disable two-factor authentication?", description: "Your account will be less protected.", confirmLabel: "Disable", danger: true })) { setMfa(false); toast("Two-factor authentication disabled."); } }}>Disable</Button>
            : <Button onClick={() => { setCode(""); setCodeErr(""); setMfaOpen(true); }}>Set up</Button>}</div>
      </Card>
      <Card>
        <CardHeader title="Active sessions" description="Devices signed in to your account." action={sessions.length > 1 ? <Button size="sm" variant="outline" onClick={async () => { if (await confirm({ title: "Sign out all other sessions?", description: "Every device except this one will be signed out.", confirmLabel: "Sign out others" })) { setSessions((p) => p.filter((s) => s.current)); toast("Other sessions revoked."); } }}>Revoke all others</Button> : undefined} />
        <ul className="divide-y divide-line">{sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-5 py-3.5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface2 text-muted">{s.mobile ? <Smartphone size={16} /> : <Laptop size={16} />}</span>
            <div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-sm font-medium">{s.device}{s.current && <Badge tone="success">This device</Badge>}</p><p className="text-xs text-muted">{s.place} · {s.last}</p></div>
            {!s.current && <Button size="sm" variant="outline" onClick={() => { setSessions((p) => p.filter((x) => x.id !== s.id)); toast("Session revoked."); }}>Revoke</Button>}</li>))}</ul>
      </Card>
      <Modal open={mfaOpen} onClose={() => setMfaOpen(false)} title="Set up authenticator" description="Simulated: no real secret is generated."
        footer={<><Button variant="outline" onClick={() => setMfaOpen(false)}>Cancel</Button><Button onClick={() => { if (!/^\d{6}$/.test(code)) { setCodeErr("Enter the 6-digit code from your app."); return; } setMfa(true); setMfaOpen(false); toast("Two-factor authentication enabled (simulated)."); }}>Verify and enable</Button></>}>
        <div className="space-y-4">
          <div className="mx-auto grid h-36 w-36 grid-cols-8 gap-0.5 rounded-lg border border-line bg-white p-2" aria-label="Placeholder QR code" role="img">{Array.from({ length: 64 }, (_, i) => <span key={i} className={(i * 7 + (i >> 3) * 3) % 5 < 2 ? "bg-slate-900" : "bg-white"} />)}</div>
          <p className="text-center text-xs text-muted">Scan with an authenticator app, or enter key <span className="font-mono">DEMO-4F7K-92QX</span></p>
          <Field label="6-digit code" required error={codeErr} hint="Demo: any 6 digits work.">{(id, d) => <Input id={id} inputMode="numeric" maxLength={6} aria-describedby={d} aria-invalid={!!codeErr} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setCodeErr(""); }} />}</Field>
        </div>
      </Modal>
    </div>
  );
}

const NOTIFY = [
  ["review", "Dataset reviews", "Approved, rejected or changes requested"], ["earnings", "Earnings", "Credits to your balance"], ["payouts", "Withdrawals and payments", "Approvals and completed payments"],
  ["messages", "Messages", "Replies from reviewers and support"], ["tasks", "Annotation tasks", "New assignments and deadlines"]
] as const;
function Notify() {
  const { toast } = useUI();
  const [s, setS] = useDemoState<Record<string, { email: boolean; app: boolean }>>("contrib:notify", Object.fromEntries(NOTIFY.map(([k]) => [k, { email: true, app: true }])));
  const set = (k: string, ch: "email" | "app", v: boolean) => { setS((p) => ({ ...p, [k]: { ...p[k], [ch]: v } })); toast("Preference saved.", "info"); };
  return (
    <Card>
      <CardHeader title="Notification preferences" description="Choose how you hear about each kind of event." />
      <div className="divide-y divide-line">
        <div className="hidden grid-cols-[1fr_80px_80px] gap-4 px-5 py-2 text-xs font-medium text-muted sm:grid"><span>Event</span><span>Email</span><span>In-app</span></div>
        {NOTIFY.map(([k, t, h]) => (
          <div key={k} className="grid items-center gap-3 px-5 py-4 sm:grid-cols-[1fr_80px_80px] sm:gap-4">
            <div><p className="text-sm font-medium">{t}</p><p className="text-xs text-muted">{h}</p></div>
            <div className="flex items-center gap-2 text-xs text-muted"><Switch label={`${t} by email`} checked={s[k]?.email ?? true} onChange={(v) => set(k, "email", v)} /><span className="sm:hidden">Email</span></div>
            <div className="flex items-center gap-2 text-xs text-muted"><Switch label={`${t} in-app`} checked={s[k]?.app ?? true} onChange={(v) => set(k, "app", v)} /><span className="sm:hidden">In-app</span></div>
          </div>))}
      </div>
    </Card>
  );
}

function Appearance() {
  const { theme, setTheme } = useTheme();
  const { toast } = useUI();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [lang, setLang] = useDemoState<"en" | "km">("contrib:lang", "en");
  const [density, setDensity] = useDemoState<"comfortable" | "compact">("contrib:density", "comfortable");
  const Opt = ({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label: string }) => (
    <button type="button" aria-pressed={active} aria-label={label} onClick={onClick} className={cn("flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors", active ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-muted/60")}>{children}</button>
  );
  return (
    <div className="space-y-6">
      <Card><CardHeader title="Theme" description="Follows your device by default." />
        <div className="flex gap-3 p-5">{([["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]] as const).map(([v, l, I]) => <Opt key={v} label={`${l} theme`} active={mounted && theme === v} onClick={() => setTheme(v)}><I size={18} />{l}</Opt>)}</div></Card>
      <Card><CardHeader title="Language" description="Only the labels are saved. Full translation is not part of this demo." />
        <div className="flex gap-3 p-5"><Opt label="English" active={lang === "en"} onClick={() => { setLang("en"); toast("Language preference saved: English", "info"); }}>English</Opt>
          <Opt label="Khmer" active={lang === "km"} onClick={() => { setLang("km"); toast("Language preference saved: Khmer", "info"); }}><span className="khmer">ខ្មែរ</span></Opt></div></Card>
      <Card><CardHeader title="Density" description="How much space tables and lists use." />
        <div className="flex gap-3 p-5">{(["comfortable", "compact"] as const).map((v) => <Opt key={v} label={`${v} density`} active={density === v} onClick={() => { setDensity(v); toast(`Density: ${v}`, "info"); }}><span className="capitalize">{v}</span></Opt>)}</div></Card>
    </div>
  );
}

function A11y() {
  const [p, setP] = useDemoState<{ text: boolean; motion: boolean; contrast: boolean; focus: boolean }>("contrib:a11y", { text: false, motion: false, contrast: false, focus: true });
  useEffect(() => {
    const el = document.documentElement; el.style.fontSize = p.text ? "112.5%" : "";
    return () => { el.style.fontSize = ""; };
  }, [p.text]);
  const items = [["text", "Larger text", "Increase text size across the app (applies on this page now)"], ["motion", "Reduce motion", "Minimise animations. Your system setting is always respected."], ["contrast", "Higher contrast", "Stronger borders and text colours"], ["focus", "Always show keyboard focus", "Visible focus ring on every control"]] as const;
  return (
    <Card><CardHeader title="Accessibility" description="Saved for your account in this browser." />
      <div className="divide-y divide-line">{items.map(([k, t, h]) => (
        <div key={k} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-medium">{t}</p><p className="text-xs text-muted">{h}</p></div><Switch label={t} checked={p[k]} onChange={(v) => setP({ ...p, [k]: v })} /></div>))}</div>
    </Card>
  );
}

function Privacy() {
  const { toast, confirm } = useUI();
  const [s, setS] = useDemoState<{ analytics: boolean; showName: boolean }>("contrib:privacy", { analytics: true, showName: false });
  return (
    <div className="space-y-6">
      <Card><CardHeader title="Privacy" />
        <div className="divide-y divide-line">
          <div className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-medium">Product analytics</p><p className="text-xs text-muted">Help us improve DataHub with anonymous usage data.</p></div><Switch label="Product analytics" checked={s.analytics} onChange={(v) => setS({ ...s, analytics: v })} /></div>
          <div className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-medium">Credit me by name</p><p className="text-xs text-muted">Show your name as a contributor on approved public datasets.</p></div><Switch label="Credit me by name" checked={s.showName} onChange={(v) => setS({ ...s, showName: v })} /></div>
        </div></Card>
      <Card><CardHeader title="Your data" />
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">Download a copy of your profile, uploads metadata and earnings history.</p><Button variant="outline" onClick={() => toast("Export requested (simulated). No file will be created in demo mode.", "info")}>Request export</Button></div>
          <Alert tone="danger" title="Delete account" action={<Button variant="danger" size="sm" onClick={async () => { if (await confirm({ title: "Delete your account?", description: "In production this permanently removes your account. In this demo nothing is deleted.", confirmLabel: "Delete account", danger: true })) toast("Simulated: your account was not actually deleted.", "info"); }}>Delete</Button>}>Pending earnings must be withdrawn or forfeited first.</Alert>
        </div></Card>
    </div>
  );
}
