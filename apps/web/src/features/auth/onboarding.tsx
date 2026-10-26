"use client";
import { Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/ui/overlays";
import { Alert, Badge, Card, Field, Input, Select } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useDemoState, wait } from "@/lib/demo";
import { CATEGORIES } from "@/mock/data";
import { safeNext } from "./auth-ui";

const STEPS = [
  { id: "profile", label: "Profile" },
  { id: "agreement", label: "Agreement" },
  { id: "rights", label: "Rights" },
  { id: "verification", label: "Payout" }
] as const;
type StepId = (typeof STEPS)[number]["id"];

type State = {
  name: string; country: string; language: string; types: string[];
  agreed: boolean; agreedAt?: string;
  rights: [boolean, boolean, boolean]; signature: string;
  method: string; account: string; accountName: string; verification: "unverified" | "pending"; completed: boolean;
};
const INITIAL: State = { name: "", country: "", language: "Khmer", types: [], agreed: false, rights: [false, false, false], signature: "", method: "", account: "", accountName: "", verification: "unverified", completed: false };
const COUNTRIES = ["Cambodia", "Thailand", "Vietnam", "Laos", "Singapore", "United States", "Other"];
const RIGHTS = [
  "I own the content I upload, or I hold written authorization from the rights holder to contribute it.",
  "My uploads will not infringe copyright, privacy or any other third-party right.",
  "I understand that DataHub receives a licence to accepted content as described in the Data Ownership and Licensing Policy."
];

const profileSchema = z.object({ name: z.string().trim().min(2, "Enter your full name."), country: z.string().min(1, "Select your country."), types: z.array(z.string()).min(1, "Choose at least one document type.") });
const rightsSchema = z.object({ rights: z.tuple([z.literal(true), z.literal(true), z.literal(true)]), signature: z.string().trim().min(2, "Type your full name to sign.") });
const payoutSchema = z.object({ method: z.string().min(1, "Choose a payout method."), accountName: z.string().trim().min(2, "Enter the account holder name."), account: z.string().trim().min(5, "Enter a valid account or phone number.") });

export function Onboarding() {
  const params = useSearchParams();
  const router = useRouter();
  const { toast } = useUI();
  const [s, setS, resetState] = useDemoState<State>("onboarding", INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"));
  const stepParam = params.get("step");
  const step: StepId = STEPS.some((x) => x.id === stepParam) ? (stepParam as StepId) : "profile";
  const idx = STEPS.findIndex((x) => x.id === step);

  const done: Record<StepId, boolean> = {
    profile: profileSchema.safeParse(s).success, agreement: s.agreed,
    rights: rightsSchema.safeParse(s).success, verification: s.verification === "pending" || payoutSchema.safeParse(s).success
  };
  const go = (id: StepId) => router.push(`/onboarding?step=${id}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  const patch = (p: Partial<State>) => { setS((x) => ({ ...x, ...p })); setErrors({}); };
  const fail = (r: z.SafeParseError<unknown>) => { const e: Record<string, string> = {}; r.error.issues.forEach((i) => { const k = String(i.path[0] ?? "form"); e[k] ??= i.message; }); setErrors(e); };

  const advance = () => {
    const r = step === "profile" ? profileSchema.safeParse(s) : step === "rights" ? rightsSchema.safeParse(s) : { success: true as const };
    if (!r.success) { fail(r); return; }
    if (step === "agreement" && !s.agreed) { setErrors({ agreed: "Accept the agreement to continue." }); return; }
    setErrors({}); go(STEPS[idx + 1].id);
  };
  const finish = async () => {
    setBusy(true); await wait(900); setS((x) => ({ ...x, completed: true })); setBusy(false);
    toast("Onboarding complete. You can now upload datasets."); router.push(next ?? "/dashboard");
  };
  const submitVerification = async () => {
    const r = payoutSchema.safeParse(s); if (!r.success) { fail(r); return; }
    setBusy(true); await wait(1000); setBusy(false); patch({ verification: "pending" });
    toast("Submitted for verification (demo). Review usually takes 1 to 2 days.", "info");
  };

  return (
    <div className="relative left-1/2 w-[min(calc(100vw-2rem),40rem)] -translate-x-1/2">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Set up your contributor account</h1><p className="mt-1 text-sm text-muted">Step {idx + 1} of {STEPS.length}</p></div>
        <Button variant="ghost" onClick={() => { toast("Progress saved. Finish onboarding before uploading.", "info"); router.push("/dashboard"); }}>Finish later</Button>
      </div>
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Onboarding progress">
        {STEPS.map((x, i) => {
          const reachable = i <= idx || STEPS.slice(0, i).every((p) => done[p.id]);
          return (
            <li key={x.id}>
              <button type="button" disabled={!reachable} onClick={() => go(x.id)} aria-current={i === idx ? "step" : undefined} className="group w-full text-left disabled:cursor-not-allowed">
                <span className={cn("block h-1.5 rounded-full", i === idx ? "bg-brand" : done[x.id] ? "bg-success" : "bg-line")} />
                <span className="mt-2 flex items-center gap-1.5 text-xs font-medium">
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px]", done[x.id] && i !== idx ? "bg-success-soft text-success" : i === idx ? "bg-brand text-white" : "bg-surface2 text-muted")}>{done[x.id] && i !== idx ? <Check size={12} aria-hidden /> : i + 1}</span>
                  <span className={cn("truncate", i === idx ? "text-fg" : "text-muted")}>{x.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <Card className="p-6 shadow-pop sm:p-8">
        {step === "profile" && (
          <Panel title="Tell us about yourself" description="This helps us route your datasets to the right reviewers.">
            <Field label="Full name" error={errors.name} required>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.name} value={s.name} onChange={(e) => patch({ name: e.target.value })} autoComplete="name" />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Country" error={errors.country} required>{(id, d) => <Select id={id} aria-describedby={d} aria-invalid={!!errors.country} value={s.country} onChange={(e) => patch({ country: e.target.value })}><option value="">Select country</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
              <Field label="Primary document language">{(id) => <Select id={id} value={s.language} onChange={(e) => patch({ language: e.target.value })}><option>Khmer</option><option>English</option><option>Mixed</option><option>Other</option></Select>}</Field>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Preferred document types <span className="text-danger" aria-hidden>*</span></legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {CATEGORIES.map((c) => { const on = s.types.includes(c); return (
                  <label key={c} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand", on ? "border-brand bg-brand-soft" : "border-line hover:bg-surface2")}>
                    <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={on} onChange={() => patch({ types: on ? s.types.filter((t) => t !== c) : [...s.types, c] })} />{c}
                  </label>); })}
              </div>
              {errors.types && <p role="alert" className="mt-1.5 text-xs text-danger">{errors.types}</p>}
            </fieldset>
          </Panel>
        )}

        {step === "agreement" && (
          <Panel title="Contributor Agreement" description="Read and accept the agreement to contribute and earn.">
            <div tabIndex={0} role="region" aria-label="Contributor agreement summary" className="scroll-thin max-h-56 space-y-3 overflow-y-auto rounded-lg border border-line bg-surface2 p-4 text-sm leading-6 text-muted">
              <p><strong className="text-fg">Eligibility.</strong> You are an adult and may legally contribute the content you upload.</p>
              <p><strong className="text-fg">Warranties.</strong> You own or are authorized to contribute the content, and it does not violate any law or third-party right.</p>
              <p><strong className="text-fg">Quality.</strong> No duplicates or synthetic content presented as original. Reviewers decide acceptance.</p>
              <p><strong className="text-fg">Compensation.</strong> Raw data earns $1.00 and labeled data $1.50 per accepted GB. Uploaded does not mean paid; payouts are approved manually.</p>
              <p><strong className="text-fg">Breach.</strong> Misdeclared rights or fraud may lead to content removal, reversal of earnings and suspension.</p>
            </div>
            <Link href="/legal/contributor-agreement" target="_blank" className="inline-block text-sm font-medium text-brand hover:underline">Read the full agreement</Link>
            <div>
              <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--brand)]" checked={s.agreed} onChange={(e) => patch({ agreed: e.target.checked, agreedAt: e.target.checked ? new Date().toISOString() : undefined })} />I have read and accept the Contributor Agreement.</label>
              {errors.agreed && <p role="alert" className="mt-1.5 text-xs text-danger">{errors.agreed}</p>}
            </div>
          </Panel>
        )}

        {step === "rights" && (
          <Panel title="Data ownership and rights" description={<>Declare your rights. See the <Link href="/legal/data-ownership" target="_blank" className="text-brand hover:underline">Data Ownership and Licensing Policy</Link>.</>}>
            <fieldset className="space-y-2.5">
              <legend className="sr-only">Rights declarations</legend>
              {RIGHTS.map((t, i) => (
                <label key={t} className="flex items-start gap-2.5 rounded-lg border border-line p-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]" checked={s.rights[i]} onChange={(e) => patch({ rights: s.rights.map((v, j) => (j === i ? e.target.checked : v)) as State["rights"] })} />{t}</label>
              ))}
              {errors.rights && <p role="alert" className="text-xs text-danger">Confirm all three statements to continue.</p>}
            </fieldset>
            <Field label="Type your full name to sign" error={errors.signature} required>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.signature} value={s.signature} onChange={(e) => patch({ signature: e.target.value })} />}</Field>
          </Panel>
        )}

        {step === "verification" && (
          <Panel title="Payout and verification" description="Optional now. You need a verified identity and payout method before your first withdrawal.">
            <div className="flex items-center justify-between rounded-lg bg-surface2 p-3 text-sm"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-muted" aria-hidden />Verification status</span>{s.verification === "pending" ? <Badge tone="warning" dot>Pending review</Badge> : <Badge dot>Not started</Badge>}</div>
            {s.verification === "pending" ? <Alert tone="success" title="Submitted for verification">This is a simulation. In production a team member would review your details within 1 to 2 days.</Alert> : (
              <>
                <Field label="Payout method" error={errors.method}>{(id, d) => <Select id={id} aria-describedby={d} aria-invalid={!!errors.method} value={s.method} onChange={(e) => patch({ method: e.target.value })}><option value="">Select method</option><option>Bank transfer (ABA)</option><option>Wing</option><option>PayPal</option></Select>}</Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Account holder name" error={errors.accountName}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.accountName} value={s.accountName} onChange={(e) => patch({ accountName: e.target.value })} />}</Field>
                  <Field label="Account or phone number" error={errors.account} hint="Demo only. Never enter real banking data.">{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.account} value={s.account} onChange={(e) => patch({ account: e.target.value })} />}</Field>
                </div>
                <Button variant="outline" onClick={submitVerification} loading={busy}>Submit for verification</Button>
              </>
            )}
          </Panel>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          <Button variant="ghost" disabled={idx === 0} onClick={() => go(STEPS[idx - 1].id)}>Back</Button>
          {idx < STEPS.length - 1 ? <Button onClick={advance}>Continue</Button> : <Button onClick={finish} loading={busy}>Finish and go to dashboard</Button>}
        </div>
      </Card>
      {s.completed && <p className="mt-4 text-center text-xs text-muted">Onboarding already completed. <button className="text-brand hover:underline" onClick={() => { resetState(); toast("Onboarding reset.", "info"); go("profile"); }}>Reset demo</button></p>}
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return <div className="space-y-4"><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-muted">{description}</p></div>{children}</div>;
}
