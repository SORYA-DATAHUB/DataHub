"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, CircleCheck, FileSearch, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/ui/overlays";
import { Card, CardHeader, Field, Input, PageHeader, Select, Skeleton, Textarea } from "@/components/ui/primitives";
import { cn, gb, usd } from "@/lib/cn";
import { wait } from "@/lib/demo";
import { ACCEPTED_FORMATS, RATES } from "@/mock/data";
import { CATEGORY_HINTS, DATA_TYPES, LANGUAGES, fmtBytes, type CDataset } from "./data";
import { useDatasets } from "./hooks";
import { useUploadQueue } from "./upload-engine";
import { UploadPanel } from "./upload-panel";

const schema = z.object({
  title: z.string().trim().min(3, "Enter a title of at least 3 characters").max(120, "Keep the title under 120 characters"),
  description: z.string().trim().min(10, "Describe the dataset in at least 10 characters").max(1000, "Keep the description under 1,000 characters"),
  language: z.string().min(1, "Choose the main language"),
  source: z.string().trim().min(3, "Tell us where this data came from"),
  dataType: z.string().min(1, "Choose a data type"),
  kind: z.enum(["raw", "labeled"]),
  declaration: z.boolean().refine((v) => v, "You must confirm you have the right to share this data")
});
type Form = z.infer<typeof schema>;
const STEPS = ["Category", "Details", "Upload files", "Preview and validate", "Review and submit"];
const DRAFT_PREFIX = "datahub-demo:contrib:upq:";

export function Uploader() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast, confirm } = useUI();
  const { datasets, add } = useDatasets();
  const q = useUploadQueue();
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("");
  const [created, setCreated] = useState<CDataset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accept, setAccept] = useState(85);
  const [checking, setChecking] = useState(false);
  const [ack, setAck] = useState(false);
  const form = useForm<Form>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { title: "", description: "", language: "", source: "", dataType: "", kind: "raw", declaration: false } });
  const { register, formState: { errors }, watch, trigger, getValues } = form;
  const kind = watch("kind");
  const pre = sp.get("category");
  useEffect(() => { if (pre && Object.keys(CATEGORY_HINTS).includes(pre)) { setCategory(pre); setStep((s) => (s === 0 ? 1 : s)); } }, [pre]);

  const rate = RATES[kind];
  const eligibleBytes = q.stats.doneBytes;
  const eligibleGb = eligibleBytes / 1073741824;
  const maxEarn = eligibleGb * rate;
  const estEarn = maxEarn * (accept / 100);

  const next = async () => {
    if (step === 0 && !category) { toast("Choose a category to continue.", "error"); return; }
    if (step === 1 && !(await trigger())) { toast("Fix the highlighted fields to continue.", "error"); return; }
    if (step === 2) {
      if (q.stats.count.done === 0) { toast("Upload at least one file to continue.", "error"); return; }
      if (q.stats.count.active > 0) { toast("Wait for uploads to finish, or pause them, before continuing.", "error"); return; }
      setChecking(true); setAck(false); setStep(3); await wait(1100); setChecking(false); return;
    }
    if (step === 3 && !ack && (q.stats.count.failed + q.stats.count.duplicate + q.stats.count.invalid > 0)) { toast("Acknowledge the excluded files to continue.", "error"); return; }
    setStep((s) => Math.min(4, s + 1));
  };
  const nextId = () => `DS-${10600 + datasets.filter((d) => /^DS-106\d\d$/.test(d.id)).length + 1}`;
  const make = (status: CDataset["status"], draft: boolean): CDataset => {
    const v = getValues();
    return { id: nextId(), title: v.title || "Untitled dataset", description: v.description, category, language: v.language, kind: v.kind, status, uploaded: "2026-10-26", sizeGb: Math.round(Math.max(eligibleGb, 0.01) * 100) / 100, acceptedGb: 0, files: q.stats.count.done, qualityScore: null, ownerId: "u-1", owner: "Sokha Chan", source: v.source, dataType: v.dataType, draft };
  };
  const submit = async () => {
    const ok = await confirm({ title: "Submit for review?", description: `${q.stats.count.done} files (${gb(eligibleGb)}) will be sent to reviewers. Estimated earnings of up to ${usd(maxEarn)} are only paid for accepted, unique, eligible data after approval.`, confirmLabel: "Submit dataset" });
    if (!ok) return;
    setSubmitting(true); await wait(1200);
    const d = make("processing", false); add(d); setCreated(d); setSubmitting(false); toast("Dataset submitted. This is a simulated submission.");
  };
  const saveDraft = async () => {
    if (!(await trigger())) { setStep(1); toast("Add the dataset details first so the draft can be saved.", "error"); return; }
    const d = make("uploading", true); add(d);
    try { localStorage.setItem(DRAFT_PREFIX + d.id, JSON.stringify(q.files.map((f) => (f.status === "uploading" || f.status === "queued" ? { ...f, status: "paused", speed: 0 } : f)))); } catch { /* storage unavailable */ }
    toast("Draft saved. You can resume the upload any time.");
    router.push(`/datasets/${d.id}/upload`);
  };
  const reset = () => { q.clear(); setStep(0); setCategory(""); setCreated(null); setAck(false); form.reset(); };

  if (created) return <Success d={created} onAnother={reset} estimate={estEarn} kind={kind} />;

  const excluded = q.stats.count.failed + q.stats.count.duplicate + q.stats.count.invalid;
  const sample = q.files.filter((f) => f.status === "done").slice(0, 4);
  const checks: Array<{ tone: "pass" | "warn" | "fail"; title: string; text: string }> = [
    { tone: q.stats.count.invalid ? "warn" : "pass", title: "File formats", text: q.stats.count.invalid ? `${q.stats.count.invalid} file(s) use a format we do not accept and were skipped.` : `All files are in an accepted format (${ACCEPTED_FORMATS.join(", ")}).` },
    { tone: q.stats.count.duplicate ? "warn" : "pass", title: "Duplicates", text: q.stats.count.duplicate ? `${q.stats.count.duplicate} duplicate file(s) were skipped. Duplicates never earn.` : "No duplicates found against existing datasets." },
    { tone: q.stats.count.failed ? "fail" : "pass", title: "Upload integrity", text: q.stats.count.failed ? `${q.stats.count.failed} file(s) failed and are excluded. Go back to retry them.` : "All uploaded files passed checksum verification." },
    { tone: ["Scanned documents", "Handwritten documents", "Historical documents"].includes(category) ? "warn" : "pass", title: "Personal data scan (simulated)", text: ["Scanned documents", "Handwritten documents", "Historical documents"].includes(category) ? "Scans may contain names or ID numbers. Redact personal data before review or files may be rejected." : "No personal data patterns detected." },
    { tone: "pass", title: "Size and metadata", text: `Total ${fmtBytes(q.stats.total)} is within the 50 GB dataset limit and your details are complete.` }
  ];

  return (
    <>
      <PageHeader title="Upload dataset" description="Five quick steps. Upload is simulated in this demo: nothing leaves your device and nothing is paid until reviewers accept your data." />
      <Stepper step={step} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <Card>
              <CardHeader title="What are you uploading?" description="Pick the closest category. Reviewers use it to route your data." />
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                {Object.entries(CATEGORY_HINTS).map(([c, hint]) => (
                  <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}
                    className={cn("flex items-start gap-3 rounded-xl border p-4 text-left transition-colors", category === c ? "border-brand bg-brand-soft" : "border-line hover:border-muted/60")}>
                    <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", category === c ? "border-brand bg-brand text-white" : "border-line")}>{category === c && <Check size={12} />}</span>
                    <span><span className="block text-sm font-medium">{c}</span><span className="text-xs text-muted">{hint}</span></span>
                  </button>))}
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardHeader title="Dataset details" description={`Category: ${category}`} action={<Button variant="ghost" size="sm" onClick={() => setStep(0)}>Change</Button>} />
              <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void next(); }} noValidate>
                <div className="sm:col-span-2"><Field label="Title" required error={errors.title?.message}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.title} placeholder="e.g. Ministry gazette archive 1994-2003" {...register("title")} />}</Field></div>
                <div className="sm:col-span-2"><Field label="Description" required error={errors.description?.message} hint="What is in it, time period, and anything reviewers should know.">{(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.description} {...register("description")} />}</Field></div>
                <Field label="Main language" required error={errors.language?.message}>{(id, d) => <Select id={id} aria-describedby={d} aria-invalid={!!errors.language} {...register("language")}><option value="">Select language</option>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</Select>}</Field>
                <Field label="Data type" required error={errors.dataType?.message}>{(id, d) => <Select id={id} aria-describedby={d} aria-invalid={!!errors.dataType} {...register("dataType")}><option value="">Select data type</option>{DATA_TYPES.map((l) => <option key={l}>{l}</option>)}</Select>}</Field>
                <div className="sm:col-span-2"><Field label="Source" required error={errors.source?.message} hint="Where does the data come from? Archive, organisation, personal collection…">{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.source} {...register("source")} />}</Field></div>
                <fieldset className="sm:col-span-2">
                  <legend className="mb-1.5 text-sm font-medium">Raw or labeled</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([["raw", "Raw data", "Unannotated files as you collected them", RATES.raw], ["labeled", "Labeled data", "Includes labels, transcripts or annotations", RATES.labeled]] as const).map(([v, t, h, r]) => (
                      <label key={v} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand", kind === v ? "border-brand bg-brand-soft" : "border-line")}>
                        <input type="radio" value={v} className="mt-1" {...register("kind")} /><span><span className="block text-sm font-medium">{t} · {usd(r)} per accepted GB</span><span className="text-xs text-muted">{h}</span></span>
                      </label>))}
                  </div>
                </fieldset>
                <div className="sm:col-span-2">
                  <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4", errors.declaration ? "border-danger" : "border-line")}>
                    <input type="checkbox" className="mt-1" aria-invalid={!!errors.declaration} {...register("declaration")} />
                    <span className="text-sm">I own this data or have the legal right to share it, and it contains no unredacted personal data. I accept the <Link href="/legal/contributor-agreement" className="text-brand underline" target="_blank">Contributor Agreement</Link>.</span>
                  </label>
                  {errors.declaration && <p role="alert" className="mt-1.5 text-xs text-danger">{errors.declaration.message}</p>}
                </div>
              </form>
            </Card>
          )}

          {step === 2 && <UploadPanel q={q} />}

          {step === 3 && (
            checking ? <Card className="space-y-3 p-5" aria-busy="true"><p className="text-sm font-medium">Running automatic checks…</p>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</Card> : (
              <>
                <Card>
                  <CardHeader title="Validation results" description="Automatic checks on your uploaded files" />
                  <ul className="divide-y divide-line">{checks.map((c) => {
                    const I = c.tone === "pass" ? CircleCheck : c.tone === "warn" ? TriangleAlert : CircleAlert;
                    return <li key={c.title} className="flex gap-3 px-5 py-3.5"><I size={18} className={cn("mt-0.5 shrink-0", c.tone === "pass" ? "text-success" : c.tone === "warn" ? "text-warning" : "text-danger")} aria-hidden />
                      <div><p className="text-sm font-medium">{c.title}<span className="sr-only"> ({c.tone})</span></p><p className="text-sm text-muted">{c.text}</p></div></li>;
                  })}</ul>
                </Card>
                {excluded > 0 && (
                  <Card className="p-4"><label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                    I understand that {excluded} file{excluded > 1 ? "s" : ""} (failed, duplicate or unsupported) will be excluded and will not earn.</label></Card>
                )}
                <Card>
                  <CardHeader title="Preview" description="First uploaded files" />
                  <ul className="grid gap-3 p-5 sm:grid-cols-2">{sample.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 rounded-lg border border-line p-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-soft to-surface2 text-muted"><FileSearch size={18} aria-hidden /></span>
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{f.name}</span><span className="text-xs text-muted">{fmtBytes(f.size)} · ready for review</span></span></li>))}</ul>
                </Card>
              </>
            )
          )}

          {step === 4 && (
            <Card>
              <CardHeader title="Review and submit" description="Check everything before sending to reviewers." />
              <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
                {[["Title", getValues("title")], ["Category", category], ["Language", getValues("language")], ["Data type", getValues("dataType")], ["Source", getValues("source")], ["Raw or labeled", `${kind === "raw" ? "Raw" : "Labeled"} (${usd(rate)} per accepted GB)`], ["Files to submit", `${q.stats.count.done} files · ${fmtBytes(eligibleBytes)}`], ["Excluded files", `${excluded}`]].map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>))}
                <div className="sm:col-span-2"><dt className="text-xs text-muted">Description</dt><dd>{getValues("description")}</dd></div>
              </dl>
              <div className="border-t border-line p-5"><p className="flex items-center gap-2 text-sm"><ShieldCheck size={16} className="text-success" aria-hidden />Ownership declaration accepted</p></div>
            </Card>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}><ArrowLeft size={14} />Back</Button>}
              {step >= 2 && <Button variant="ghost" onClick={() => { void saveDraft(); }} disabled={submitting}>Save draft</Button>}
            </div>
            {step < 4 ? <Button onClick={() => { void next(); }} disabled={checking}>Continue<ArrowRight size={14} /></Button>
              : <Button onClick={() => { void submit(); }} loading={submitting} disabled={q.stats.count.done === 0}>Submit for review</Button>}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start" aria-label="Estimated earnings">
          <Card>
            <CardHeader title="Estimated earnings" description="A guide only. Not a payment." />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between"><span className="text-muted">Rate</span><span className="font-medium">{usd(rate)} / accepted GB</span></div>
              <div className="flex justify-between"><span className="text-muted">Uploaded, unique files</span><span className="tabular font-medium">{fmtBytes(eligibleBytes)}</span></div>
              <div className="flex justify-between"><span className="text-muted">If 100% accepted</span><span className="tabular font-medium">{usd(maxEarn)}</span></div>
              <div>
                <label htmlFor="accept" className="flex justify-between text-muted"><span>Assumed acceptance</span><span className="tabular">{accept}%</span></label>
                <input id="accept" type="range" min={10} max={100} step={5} value={accept} onChange={(e) => setAccept(Number(e.target.value))} className="mt-2 w-full accent-[var(--brand)]" />
              </div>
              <div className="flex items-end justify-between border-t border-line pt-3"><span className="text-muted">Estimated</span><span className="tabular text-2xl font-semibold">{usd(estEarn)}</span></div>
              <p className="flex gap-2 text-xs text-muted"><Info size={13} className="mt-0.5 shrink-0" aria-hidden />Uploaded is not paid. Only accepted, unique and eligible data earns. Withdrawals are approved manually, minimum $25, after verification.</p>
            </div>
          </Card>
          {step >= 2 && q.files.length > 0 && <p className="text-xs text-muted" aria-live="polite">{q.stats.count.done} uploaded · {q.stats.count.active} in progress · {excluded} excluded</p>}
        </aside>
      </div>
    </>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <nav aria-label="Upload steps"><ol className="flex gap-2 overflow-x-auto">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === step ? "step" : undefined} className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium", i === step ? "border-brand bg-brand-soft text-brand" : i < step ? "border-line text-fg" : "border-line text-muted")}>
          <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]", i < step ? "bg-success text-white" : i === step ? "bg-brand text-white" : "bg-surface2")}>{i < step ? <Check size={11} /> : i + 1}</span>
          <span className={cn("truncate", i !== step && "hidden sm:block")}>{s}</span>
        </li>))}
    </ol></nav>
  );
}

function Success({ d, estimate, kind, onAnother }: { d: CDataset; estimate: number; kind: "raw" | "labeled"; onAnother: () => void }) {
  return (
    <div className="mx-auto max-w-xl">
      <Card className="p-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 size={28} /></span>
        <h1 className="text-xl font-semibold">Dataset submitted</h1>
        <p className="mt-1 text-sm text-muted">{d.title} ({d.id}) is now processing. This was a simulated upload: no files were sent.</p>
        <ol className="mx-auto mt-6 max-w-sm space-y-3 text-left text-sm">
          {["We process and check your files (usually minutes)", "A reviewer accepts or rejects files (usually 1 to 3 days)", `Accepted ${kind} data is credited at ${usd(RATES[kind])} per GB`, "Request a withdrawal once verified and above $25"].map((t, i) => (
            <li key={t} className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface2 text-[11px] font-semibold">{i + 1}</span>{t}</li>))}
        </ol>
        <p className="mt-5 rounded-lg bg-warning-soft p-3 text-xs text-warning">Estimated {usd(estimate)} is not earned yet. Uploaded does not mean paid.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2"><Button href={`/datasets/${d.id}`}>View dataset</Button><Button variant="outline" onClick={onAnother}>Upload another</Button><Button variant="ghost" href="/dashboard">Dashboard</Button></div>
      </Card>
    </div>
  );
}
