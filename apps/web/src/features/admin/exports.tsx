"use client";
import { Download, PackagePlus, RotateCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { Drawer, Modal, useUI } from "@/components/ui/overlays";
import { Alert, Badge, Field, Input, PageHeader, Progress, Select, StatusBadge, Switch } from "@/components/ui/primitives";
import { useDemoState } from "@/lib/demo";
import { KV, Loadable, SectionTitle, useQueryParam, useSetQuery } from "./common";
import { exportsSeed, fmtDate, gb, type ExportJob } from "./data";
import { useDatasets } from "./state";

const FORMATS = ["ZIP", "JSONL", "Parquet"];

export function AdminExports() {
  const { toast } = useUI();
  const [jobs, setJobs] = useDemoState<ExportJob[]>("admin-exports", exportsSeed);
  const setQuery = useSetQuery();
  const [newParam, setNew] = useQueryParam("new");
  const [ids] = useQueryParam("ids");
  const [jobId, setJob] = useQueryParam("job");
  const job = jobs.find((j) => j.id === jobId);
  const running = jobs.some((j) => j.status === "processing" || j.status === "queued");

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setJobs((l) => l.map((j) => {
      if (j.status !== "processing" && j.status !== "queued") return j;
      const p = Math.min(100, j.progress + 9 + Math.round(Math.random() * 8));
      return p >= 100 ? { ...j, progress: 100, status: "ready" } : { ...j, progress: p, status: "processing" };
    })), 700);
    return () => clearInterval(t);
  }, [running, setJobs]);

  const download = (j: ExportJob) => toast(`Simulated download of ${j.id}. In demo mode no archive is generated.`, "info");
  const retry = (j: ExportJob) => { setJobs((l) => l.map((x) => (x.id === j.id ? { ...x, status: "processing", progress: 5 } : x))); toast(`Retrying ${j.id}…`, "info"); };

  const cols: Column<ExportJob>[] = [
    { key: "n", header: "Export", sortValue: (j) => j.name, render: (j) => <div className="min-w-0"><p className="truncate font-medium">{j.name}</p><p className="text-xs text-muted">{j.id} · {j.datasets.join(", ")}</p></div> },
    { key: "f", header: "Format", render: (j) => j.format, hideOnMobile: true },
    { key: "s", header: "Size", sortValue: (j) => j.sizeGb, render: (j) => gb(j.sizeGb) },
    { key: "p", header: "Progress", render: (j) => <div className="w-28">{j.status === "processing" || j.status === "queued" ? <><Progress value={j.progress} label={`${j.id} progress`} /><span className="text-xs text-muted">{j.progress}%</span></> : <StatusBadge status={j.status} />}</div> },
    { key: "c", header: "Created", sortValue: (j) => j.created, render: (j) => fmtDate(j.created), hideOnMobile: true },
    { key: "a", header: "", render: (j) => j.status === "ready" ? <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); download(j); }}><Download size={14} />Download (simulated)</Button> : j.status === "failed" ? <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); retry(j); }}><RotateCw size={14} />Retry</Button> : null }
  ];

  return (
    <Loadable>
      <PageHeader title="Export center" description="Prepare dataset archives for model training. Only accepted, unique, eligible data is exported." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Exports" }]}
        actions={<Button onClick={() => setNew("1")}><PackagePlus size={14} />New export</Button>} />
      <div className="mb-4"><Alert tone="warning" title="Simulated exports">Archives are not generated in demo mode. Progress and downloads are simulated.</Alert></div>
      <DataTable rows={jobs} columns={cols} searchText={(j) => `${j.id} ${j.name} ${j.datasets.join(" ")}`} onRowClick={(j) => setJob(j.id)}
        filters={[{ label: "Status", options: ["queued", "processing", "ready", "failed"], predicate: (j, v) => j.status === v }]} empty={{ title: "No exports yet", description: "Create your first export to see it here." }} />
      <Builder open={newParam === "1"} presetIds={ids ? ids.split(",") : []} onClose={() => setQuery({ new: null, ids: null })}
        onCreate={(j) => { setJobs((l) => [j, ...l]); toast(`Export ${j.id} started (simulated).`); setQuery({ new: null, ids: null, job: j.id }); }} nextId={`EXP-${501 + jobs.length + 1}`} />
      <Drawer open={!!job} onClose={() => setJob(null)} title={job ? `${job.id}` : "Export"} description={job?.name}>
        {job && <div className="space-y-5">
          <div className="flex items-center gap-2"><StatusBadge status={job.status} /><Badge>{job.format}</Badge></div>
          {(job.status === "processing" || job.status === "queued") && <div><Progress value={job.progress} label="Export progress" /><p className="mt-1 text-xs text-muted">{job.progress}% prepared</p></div>}
          {job.status === "failed" && <Alert tone="danger" title="Export failed at 62%">Storage read timeout (simulated). You can retry.</Alert>}
          <dl className="divide-y divide-line rounded-lg border border-line px-4"><KV k="Created" v={fmtDate(job.created)} /><KV k="Created by" v={job.createdBy} /><KV k="Size" v={gb(job.sizeGb)} /><KV k="Datasets" v={job.datasets.join(", ")} /></dl>
          <div><SectionTitle>Included</SectionTitle><div className="flex flex-wrap gap-1.5">{job.include.map((i) => <Badge key={i} tone="brand">{i}</Badge>)}</div></div>
          {job.status === "ready" && <Button onClick={() => download(job)}><Download size={14} />Download (simulated)</Button>}
          {job.status === "failed" && <Button onClick={() => retry(job)}><RotateCw size={14} />Retry export</Button>}
        </div>}
      </Drawer>
    </Loadable>
  );
}

function Builder({ open, presetIds, onClose, onCreate, nextId }: { open: boolean; presetIds: string[]; onClose: () => void; onCreate: (j: ExportJob) => void; nextId: string }) {
  const { datasets } = useDatasets();
  const eligible = useMemo(() => datasets.filter((d) => (d.status === "approved" || d.status === "partially_approved") && !d.takedown), [datasets]);
  const [name, setName] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [kind, setKind] = useState("all");
  const [lang, setLang] = useState("all");
  const [incl, setIncl] = useState({ Originals: true, Annotations: false, Metadata: true });
  const [format, setFormat] = useState("ZIP");
  const [errs, setErrs] = useState<{ name?: string; sel?: string }>({});
  const [seeded, setSeeded] = useState(false);
  if (open && !seeded) { setSeeded(true); setSel(presetIds.filter((i) => eligible.some((d) => d.id === i))); setName(""); setErrs({}); }
  if (!open && seeded) setSeeded(false);
  const shown = eligible.filter((d) => (kind === "all" || d.kind === kind) && (lang === "all" || d.language === lang));
  const total = eligible.filter((d) => sel.includes(d.id)).reduce((a, d) => a + d.acceptedGb, 0);
  const skipped = presetIds.filter((i) => !eligible.some((d) => d.id === i));
  const go = () => {
    const e: typeof errs = {};
    if (name.trim().length < 3) e.name = "Give the export a name (3+ characters).";
    if (sel.length === 0) e.sel = "Select at least one dataset.";
    setErrs(e); if (Object.keys(e).length) return;
    onCreate({ id: nextId, name: name.trim(), datasets: sel, format, include: Object.entries(incl).filter(([, v]) => v).map(([k]) => k), status: "processing", progress: 4, sizeGb: Math.round(total * 10) / 10, created: "2026-10-26", createdBy: "Anna Keller" });
  };
  return (
    <Modal open={open} onClose={onClose} width="max-w-2xl" title="New export" description="Choose datasets and what to include."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={go}>Prepare export ({total.toFixed(1)} GB)</Button></>}>
      <div className="space-y-4">
        {skipped.length > 0 && <Alert tone="warning" title="Some datasets were skipped">{skipped.join(", ")} are not approved yet, so they cannot be exported.</Alert>}
        <Field label="Export name" required error={errs.name}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errs.name} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Khmer OCR training set" />}</Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Data type">{(id) => <Select id={id} value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">Raw and labeled</option><option value="raw">Raw only</option><option value="labeled">Labeled only</option></Select>}</Field>
          <Field label="Language">{(id) => <Select id={id} value={lang} onChange={(e) => setLang(e.target.value)}><option value="all">All</option><option>Khmer</option><option>English</option></Select>}</Field>
          <Field label="Format">{(id) => <Select id={id} value={format} onChange={(e) => setFormat(e.target.value)}>{FORMATS.map((f) => <option key={f}>{f}</option>)}</Select>}</Field>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between"><p className="text-sm font-medium">Datasets <span className="text-danger" aria-hidden>*</span></p><button className="text-xs text-brand hover:underline" onClick={() => setSel(sel.length === shown.length ? [] : shown.map((d) => d.id))}>{sel.length === shown.length && shown.length > 0 ? "Clear" : "Select all"}</button></div>
          <ul className="scroll-thin max-h-52 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {shown.length === 0 && <li className="p-4 text-center text-sm text-muted">No approved datasets match these filters.</li>}
            {shown.map((d) => <li key={d.id}><label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface2"><input type="checkbox" checked={sel.includes(d.id)} onChange={() => setSel((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id]))} />
              <span className="min-w-0 flex-1 truncate">{d.title}<span className="block text-xs text-muted">{d.id} · {d.kind} · {gb(d.acceptedGb)} accepted</span></span></label></li>)}
          </ul>
          {errs.sel && <p role="alert" className="mt-1 text-xs text-danger">{errs.sel}</p>}
        </div>
        <div className="space-y-2"><p className="text-sm font-medium">Include</p>
          {(Object.keys(incl) as Array<keyof typeof incl>).map((k) => <div key={k} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"><span>{k}</span><Switch label={`Include ${k}`} checked={incl[k]} onChange={(v) => setIncl({ ...incl, [k]: v })} /></div>)}</div>
      </div>
    </Modal>
  );
}
