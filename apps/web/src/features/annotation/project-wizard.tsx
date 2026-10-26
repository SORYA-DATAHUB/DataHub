"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/ui/overlays";
import { Alert, Card, Field, Input, PageHeader, Textarea } from "@/components/ui/primitives";
import { cn, usd } from "@/lib/cn";
import { wait } from "@/lib/demo";
import { datasets } from "@/mock/data";
import { ANNOTATORS, DEFAULT_INSTRUCTIONS, TODAY, type AnnTask, type AnnType, type Project } from "./data";
import { LABELS } from "./doc";
import { useQueryState } from "./shared";
import { useProjects, useTasks } from "./store";

const TYPES: Array<{ id: AnnType; desc: string }> = [
  { id: "Transcription", desc: "Type the text of scanned or handwritten pages from scratch." },
  { id: "Text correction", desc: "Fix errors in machine OCR output while checking the scan." },
  { id: "Page classification", desc: "Assign a document/page type to each page or file." },
  { id: "Metadata tagging", desc: "Add tags, language and quality metadata to each item." }
];
const STEPS = [
  { id: "source", label: "Source dataset", fields: ["datasetId"] }, { id: "type", label: "Annotation type", fields: ["type"] }, { id: "instructions", label: "Instructions", fields: ["name", "instructions", "labels"] },
  { id: "split", label: "Task split", fields: ["unit", "batchSize"] }, { id: "annotators", label: "Annotators", fields: ["annotators"] }, { id: "reward", label: "Reward & deadline", fields: ["reward", "deadline"] }, { id: "review", label: "Review & create", fields: ["confirm"] }
] as const;
type StepId = (typeof STEPS)[number]["id"];

const schema = z.object({
  datasetId: z.string().min(1, "Select a source dataset."),
  type: z.enum(["Transcription", "Text correction", "Page classification", "Metadata tagging"], { message: "Choose an annotation type." }),
  name: z.string().trim().min(3, "Name must be at least 3 characters.").max(80, "Name must be 80 characters or fewer."),
  instructions: z.string().trim().min(20, "Write at least 20 characters of instructions so annotators know what to do."),
  labels: z.array(z.string()).min(1, "Select at least one region label."),
  unit: z.enum(["page", "file", "batch"]),
  batchSize: z.number({ message: "Enter a number." }).int("Whole numbers only.").min(2, "Minimum batch size is 2.").max(50, "Maximum batch size is 50."),
  annotators: z.array(z.string()).min(1, "Select at least one annotator."),
  reward: z.number({ message: "Enter an amount." }).min(0.05, "Minimum reward is $0.05 per task.").max(5, "Maximum reward is $5.00 per task."),
  deadline: z.string().min(1, "Choose a deadline.").refine((v) => v > TODAY, "Deadline must be in the future."),
  confirm: z.literal(true, { message: "Confirm the budget to continue." })
});
type Values = z.infer<typeof schema>;
const PAGES_PER_FILE = 3;

export function ProjectWizard() {
  const router = useRouter(); const { toast, confirm } = useUI();
  const { setProjects } = useProjects(); const { setTasks } = useTasks();
  const [stepId, setStepId] = useQueryState<StepId>("step", "source", STEPS.map((s) => s.id));
  const [reached, setReached] = useState(0);
  const idx = STEPS.findIndex((s) => s.id === stepId);
  const [creating, setCreating] = useState(false);
  const eligible = datasets.filter((d) => d.status === "approved" || d.status === "partially_approved");
  const form = useForm<Values>({
    resolver: zodResolver(schema), mode: "onTouched",
    defaultValues: { datasetId: "", type: undefined, name: "", instructions: DEFAULT_INSTRUCTIONS, labels: ["Heading", "Paragraph"], unit: "page", batchSize: 10, annotators: [], reward: 0.4, deadline: "", confirm: undefined as unknown as true }
  });
  const { control, register, watch, trigger, formState: { errors }, setValue, getValues } = form;
  const v = watch();
  const ds = eligible.find((d) => d.id === v.datasetId);
  const taskCount = useMemo(() => { if (!ds) return 0; const pages = ds.files * PAGES_PER_FILE; return v.unit === "file" ? ds.files : v.unit === "page" ? pages : Math.ceil(pages / (Number(v.batchSize) || 10)); }, [ds, v.unit, v.batchSize]);
  const budget = taskCount * (Number(v.reward) || 0);

  useEffect(() => { if (idx > reached) setStepId(STEPS[reached].id); }, [idx, reached, setStepId]);

  const go = (i: number) => setStepId(STEPS[i].id);
  const next = async () => {
    const ok = await trigger(STEPS[idx].fields as unknown as Array<keyof Values>);
    if (!ok) { toast("Fix the highlighted fields to continue.", "error"); return; }
    setReached((r) => Math.max(r, idx + 1)); go(idx + 1);
  };
  const create = async () => {
    if (!(await trigger())) { toast("Some earlier steps have errors.", "error"); return; }
    const val = getValues();
    if (!(await confirm({ title: `Create "${val.name}"?`, description: `${taskCount.toLocaleString()} tasks will be generated and ${val.annotators.length} annotators notified. Budget reserved: ${usd(budget)}.`, confirmLabel: "Create project" }))) return;
    setCreating(true); await wait(900);
    const id = `P-${105 + Math.floor(Math.random() * 800)}`;
    const project: Project = { id, name: val.name, datasetId: val.datasetId, dataset: ds?.title ?? val.datasetId, type: val.type, status: "active", deadline: val.deadline, reward: val.reward, unit: val.unit, instructions: val.instructions, annotators: val.annotators, labels: val.labels, created: TODAY, quality: 0 };
    const gen = Math.min(taskCount, 36);
    const newTasks: AnnTask[] = Array.from({ length: gen }, (_, i) => ({
      id: `T-${8000 + Math.floor(Math.random() * 1000)}-${i}`, projectId: id, file: `${(ds?.title ?? "file").toLowerCase().replace(/[^a-z]+/g, "_").slice(0, 14)}_${String(i + 1).padStart(3, "0")}.pdf`, page: i + 1, pages: val.unit === "file" ? 1 : 3,
      assignee: i % 3 === 0 ? null : val.annotators[i % val.annotators.length], status: i % 3 === 0 ? "unassigned" : "assigned", deadline: val.deadline, completion: 0, quality: null, reward: val.reward, updated: TODAY, attempts: 1, feedback: []
    }));
    setProjects((l) => [project, ...l]); setTasks((l) => [...newTasks, ...l]);
    toast(`Project created with ${gen} starter tasks.`); router.push(`/admin/annotation/projects/${id}`);
  };

  const toggle = (name: "labels" | "annotators", val: string) => { const cur = getValues(name); setValue(name, cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val], { shouldValidate: true, shouldTouch: true }); };

  return (
    <>
      <PageHeader title="New annotation project" description="Seven short steps. Nothing is created until the last step." breadcrumbs={[{ label: "Annotation projects", href: "/admin/annotation/projects" }, { label: "New project" }]} />
      <nav aria-label="Wizard steps" className="scroll-thin mb-6 overflow-x-auto">
        <ol className="flex min-w-max gap-2">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button disabled={i > reached} onClick={() => go(i)} aria-current={i === idx ? "step" : undefined}
                className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors", i === idx ? "border-brand bg-brand-soft text-brand" : i < idx || i <= reached ? "border-line bg-surface hover:bg-surface2" : "border-line text-muted opacity-60")}>
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px]", i < idx ? "bg-success text-white" : i === idx ? "bg-brand text-white" : "bg-surface2")}>{i < idx ? <Check size={12} /> : i + 1}</span>{s.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <Card className="mx-auto max-w-3xl p-5 sm:p-6">
        <form onSubmit={(e) => { e.preventDefault(); void (idx === STEPS.length - 1 ? create() : next()); }} noValidate className="space-y-5">
          <h2 className="text-lg font-semibold">{idx + 1}. {STEPS[idx].label}</h2>

          {stepId === "source" && (
            <fieldset>
              <legend className="mb-3 text-sm text-muted">Only approved or partially approved datasets can be annotated.</legend>
              <Controller control={control} name="datasetId" render={({ field }) => (
                <div className="space-y-2" role="radiogroup" aria-label="Source dataset">
                  {eligible.map((d) => (
                    <label key={d.id} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors", field.value === d.id ? "border-brand bg-brand-soft" : "border-line hover:bg-surface2")}>
                      <input type="radio" className="mt-1" checked={field.value === d.id} onChange={() => field.onChange(d.id)} />
                      <span><span className="block text-sm font-medium">{d.title}</span><span className="text-xs text-muted">{d.id} · {d.language} · {d.files.toLocaleString()} files · {d.acceptedGb} GB accepted · {d.category}</span></span>
                    </label>
                  ))}
                </div>)} />
              {errors.datasetId && <p role="alert" className="mt-2 text-xs text-danger">{errors.datasetId.message}</p>}
            </fieldset>
          )}

          {stepId === "type" && (
            <fieldset>
              <Controller control={control} name="type" render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Annotation type">
                  {TYPES.map((t) => (
                    <label key={t.id} className={cn("cursor-pointer rounded-lg border p-4 transition-colors", field.value === t.id ? "border-brand bg-brand-soft" : "border-line hover:bg-surface2")}>
                      <input type="radio" className="sr-only" checked={field.value === t.id} onChange={() => field.onChange(t.id)} /><span className="block text-sm font-semibold">{t.id}</span><span className="mt-1 block text-xs text-muted">{t.desc}</span>
                    </label>
                  ))}
                </div>)} />
              {errors.type && <p role="alert" className="mt-2 text-xs text-danger">{errors.type.message}</p>}
            </fieldset>
          )}

          {stepId === "instructions" && (<>
            <Field label="Project name" required error={errors.name?.message}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.name} {...register("name")} placeholder="e.g. Gazette OCR correction — batch 2" />}</Field>
            <Field label="Instructions for annotators" required error={errors.instructions?.message} hint="Khmer and English are both supported.">{(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.instructions} rows={8} className="khmer" {...register("instructions")} />}</Field>
            <fieldset><legend className="mb-2 text-sm font-medium">Region labels</legend>
              <div className="flex flex-wrap gap-2">{LABELS.map((l) => <button type="button" key={l} aria-pressed={v.labels.includes(l)} onClick={() => toggle("labels", l)} className={cn("rounded-full border px-3 py-1 text-sm", v.labels.includes(l) ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-fg")}>{l}</button>)}</div>
              {errors.labels && <p role="alert" className="mt-2 text-xs text-danger">{errors.labels.message as string}</p>}</fieldset>
          </>)}

          {stepId === "split" && (<>
            <fieldset><legend className="mb-2 text-sm font-medium">Split the dataset into tasks by</legend>
              <div className="grid gap-2 sm:grid-cols-3">{([["page", "Page", "One task per page"], ["file", "File", "One task per whole file"], ["batch", "Batch of pages", "Several pages per task"]] as const).map(([k, t, d]) => (
                <label key={k} className={cn("cursor-pointer rounded-lg border p-3", v.unit === k ? "border-brand bg-brand-soft" : "border-line hover:bg-surface2")}><input type="radio" className="sr-only" value={k} {...register("unit")} /><span className="block text-sm font-semibold">{t}</span><span className="text-xs text-muted">{d}</span></label>))}</div></fieldset>
            {v.unit === "batch" && <Field label="Pages per batch" error={errors.batchSize?.message} hint="Between 2 and 50 pages.">{(id, d) => <Input id={id} type="number" aria-describedby={d} aria-invalid={!!errors.batchSize} className="max-w-32" {...register("batchSize", { valueAsNumber: true })} />}</Field>}
            <Alert tone="info" title={ds ? `${taskCount.toLocaleString()} tasks will be generated` : "Select a source dataset first"}>{ds ? `From ${ds.files.toLocaleString()} files in “${ds.title}” (about ${PAGES_PER_FILE} pages each).` : "Go back to step 1 to choose a dataset."}</Alert>
          </>)}

          {stepId === "annotators" && (
            <fieldset>
              <div className="mb-3 flex items-center justify-between"><legend className="text-sm text-muted">Select who can receive tasks. {v.annotators.length} selected.</legend>
                <Button type="button" variant="outline" size="sm" onClick={() => setValue("annotators", ANNOTATORS.filter((a) => a.accuracy >= 90).map((a) => a.name), { shouldValidate: true })}>Select accuracy ≥ 90%</Button></div>
              <ul className="divide-y divide-line rounded-lg border border-line">{ANNOTATORS.map((a) => (
                <li key={a.name}><label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-surface2"><input type="checkbox" checked={v.annotators.includes(a.name)} onChange={() => toggle("annotators", a.name)} />
                  <span className="flex-1 text-sm font-medium">{a.name}</span><span className="text-xs text-muted">{a.accuracy}% accuracy · {a.done} done · capacity {a.capacity}</span></label></li>))}</ul>
              {errors.annotators && <p role="alert" className="mt-2 text-xs text-danger">{errors.annotators.message as string}</p>}
            </fieldset>
          )}

          {stepId === "reward" && (<>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Reward per ${v.unit === "page" ? "page task" : v.unit === "file" ? "file task" : "batch task"} (USD)`} required error={errors.reward?.message}>{(id, d) => <Input id={id} type="number" step="0.05" aria-describedby={d} aria-invalid={!!errors.reward} {...register("reward", { valueAsNumber: true })} />}</Field>
              <Field label="Deadline" required error={errors.deadline?.message}>{(id, d) => <Input id={id} type="date" min={TODAY} aria-describedby={d} aria-invalid={!!errors.deadline} {...register("deadline")} />}</Field>
            </div>
            <div className="rounded-lg bg-surface2 p-4 text-sm"><div className="flex justify-between"><span className="text-muted">Tasks</span><span className="tabular">{taskCount.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted">Reward per task</span><span className="tabular">{usd(Number(v.reward) || 0)}</span></div>
              <div className="mt-2 flex justify-between border-t border-line pt-2 font-semibold"><span>Maximum reward budget</span><span className="tabular">{usd(budget)}</span></div></div>
            {budget > 5000 && <Alert tone="warning" title="Large budget">This exceeds $5,000 and would need Super Administrator approval in production.</Alert>}
          </>)}

          {stepId === "review" && (<>
            <dl className="divide-y divide-line rounded-lg border border-line text-sm">{[
              ["Project", v.name], ["Source dataset", ds?.title ?? "—"], ["Type", v.type], ["Split", v.unit === "batch" ? `Batches of ${v.batchSize} pages` : `Per ${v.unit}`], ["Tasks", taskCount.toLocaleString()],
              ["Annotators", v.annotators.join(", ")], ["Reward / task", usd(Number(v.reward) || 0)], ["Max budget", usd(budget)], ["Deadline", v.deadline], ["Labels", v.labels.join(", ")]
            ].map(([k, val]) => <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{val}</dd></div>)}</dl>
            <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-1" {...register("confirm")} />I confirm the instructions, annotators and reward budget are correct.</label>
            {errors.confirm && <p role="alert" className="text-xs text-danger">{errors.confirm.message}</p>}
          </>)}

          <div className="flex items-center justify-between border-t border-line pt-4">
            <Button type="button" variant="outline" disabled={idx === 0} onClick={() => go(idx - 1)}><ArrowLeft size={14} />Back</Button>
            {idx < STEPS.length - 1 ? <Button type="submit">Continue<ArrowRight size={14} /></Button> : <Button type="submit" loading={creating}>Create project</Button>}
          </div>
        </form>
      </Card>
    </>
  );
}
