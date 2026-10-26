"use client";
import { CloudUpload, FileArchive, FileImage, FileText, FolderUp, Pause, Play, RotateCw, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/ui/overlays";
import { Alert, Badge, Card, Progress, type Tone } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { fmtBytes } from "./data";
import { SAMPLE_FILES, fmtEta, type UpFile, type UpStatus, type useUploadQueue } from "./upload-engine";

type Q = ReturnType<typeof useUploadQueue>;
const STATUS: Record<UpStatus, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "neutral" }, uploading: { label: "Uploading", tone: "brand" }, paused: { label: "Paused", tone: "neutral" },
  done: { label: "Uploaded", tone: "success" }, failed: { label: "Failed", tone: "danger" }, duplicate: { label: "Duplicate", tone: "warning" }, invalid: { label: "Not accepted", tone: "danger" }
};
const icon = (n: string) => { const e = n.split(".").pop()?.toLowerCase(); return e === "zip" ? FileArchive : ["jpg", "png", "tif", "tiff"].includes(e ?? "") ? FileImage : FileText; };

export function UploadPanel({ q, allowAdd = true }: { q: Q; allowAdd?: boolean }) {
  const { toast } = useUI();
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const { files, stats } = q;
  const take = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    q.add(Array.from(list).map((f) => ({ name: f.name, size: f.size, path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || undefined })));
    toast(`${list.length} file${list.length > 1 ? "s" : ""} added. Upload is simulated: nothing leaves your device.`, "info");
  };
  const anyRunning = stats.count.active > 0;
  const shown = files.slice(0, 60);

  return (
    <div className="space-y-4">
      <Alert tone="info" title="Simulated upload">This is a demo. Progress, speed and failures are simulated, and your files are never sent anywhere.</Alert>
      {allowAdd && (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}
          className={cn("rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-8", drag ? "border-brand bg-brand-soft" : "border-line bg-surface")}>
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand"><CloudUpload size={22} /></span>
          <p className="text-sm font-medium">Drag and drop files here</p>
          <p className="mt-1 text-xs text-muted">PDF, DOCX, TXT, CSV, JSON, JPG, PNG, TIFF or ZIP. Up to 4 GB per file.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={() => fileRef.current?.click()}>Browse files</Button>
            <Button variant="outline" onClick={() => folderRef.current?.click()}><FolderUp size={14} />Choose folder</Button>
            <Button variant="outline" onClick={() => { q.add(SAMPLE_FILES); toast("Sample files added: one will fail, one is a duplicate, one is not accepted.", "info"); }}><Sparkles size={14} />Add sample files</Button>
          </div>
          <input ref={fileRef} type="file" multiple className="sr-only" tabIndex={-1} aria-label="Choose files" onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
          <input ref={folderRef} type="file" multiple className="sr-only" tabIndex={-1} aria-label="Choose folder" {...({ webkitdirectory: "" } as object)} onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
        </div>
      )}

      {files.length > 0 && (
        <Card>
          <div className="space-y-3 border-b border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-sm font-semibold">Overall progress: {Math.round(stats.pct)}%</p>
                <p className="tabular text-xs text-muted">{fmtBytes(stats.done)} of {fmtBytes(stats.total)} · {stats.count.done} of {files.length} files · {stats.speed > 0 ? `${fmtBytes(stats.speed)}/s · ETA ${fmtEta(stats.eta)}` : "idle"}</p></div>
              <div className="flex gap-2">
                {anyRunning ? <Button size="sm" variant="outline" onClick={q.pauseAll}><Pause size={13} />Pause all</Button>
                  : stats.count.paused > 0 && <Button size="sm" variant="outline" onClick={q.resumeAll}><Play size={13} />Resume all</Button>}
                {stats.count.failed > 0 && <Button size="sm" variant="outline" onClick={q.retryAll}><RotateCw size={13} />Retry failed ({stats.count.failed})</Button>}
              </div>
            </div>
            <Progress value={stats.pct} tone={stats.count.failed ? "warning" : "brand"} label="Overall upload progress" />
          </div>
          {(stats.count.duplicate > 0 || stats.count.invalid > 0) && (
            <div className="border-b border-line p-4"><Alert tone="warning" title={`${stats.count.duplicate} duplicate and ${stats.count.invalid} unaccepted file${stats.count.duplicate + stats.count.invalid === 1 ? "" : "s"} skipped`}>Duplicates and unsupported files are not uploaded and never earn. Remove them from the list to dismiss this warning.</Alert></div>
          )}
          <ul className="divide-y divide-line" aria-label="Files">
            {shown.map((f) => <Row key={f.id} f={f} q={q} />)}
          </ul>
          {files.length > shown.length && <p className="border-t border-line px-4 py-2.5 text-xs text-muted">and {files.length - shown.length} more files</p>}
        </Card>
      )}
    </div>
  );
}

function Row({ f, q }: { f: UpFile; q: Q }) {
  const Icon = icon(f.name);
  const s = STATUS[f.status];
  const bar = f.status === "failed" ? "danger" : f.status === "done" ? "success" : "brand";
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface2 text-muted"><Icon size={15} aria-hidden /></span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="truncate text-sm font-medium">{f.path ?? f.name}</span><Badge tone={s.tone} dot>{s.label}</Badge><span className="tabular text-xs text-muted">{fmtBytes(f.size)}</span></div>
        {f.status !== "duplicate" && f.status !== "invalid" && <Progress value={f.progress} tone={bar} label={`${f.name} progress`} />}
        {f.error && <p className={cn("text-xs", f.status === "failed" || f.status === "invalid" ? "text-danger" : "text-warning")}>{f.error}</p>}
        {f.status === "uploading" && <p className="tabular text-xs text-muted">{Math.round(f.progress)}% · {fmtBytes(f.speed)}/s</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        {(f.status === "uploading" || f.status === "queued") && <Button variant="ghost" size="icon" aria-label={`Pause ${f.name}`} onClick={() => q.pause(f.id)}><Pause size={14} /></Button>}
        {f.status === "paused" && <Button variant="ghost" size="icon" aria-label={`Resume ${f.name}`} onClick={() => q.resume(f.id)}><Play size={14} /></Button>}
        {f.status === "failed" && <Button variant="ghost" size="icon" aria-label={`Retry ${f.name}`} onClick={() => q.retry(f.id)}><RotateCw size={14} /></Button>}
        {f.status !== "done" && <Button variant="ghost" size="icon" aria-label={`Remove ${f.name}`} onClick={() => q.remove(f.id)}><X size={14} /></Button>}
      </div>
    </li>
  );
}
