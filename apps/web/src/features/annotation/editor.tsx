"use client";
import { AlertCircle, AlertTriangle, CheckCircle2, Cloud, Keyboard, Loader2, Monitor, Redo2, Send, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { FocusShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Modal, useUI } from "@/components/ui/overlays";
import { Alert, Badge, EmptyState, Progress, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useDemoState, useFakeLoad, wait } from "@/lib/demo";
import { TODAY, type AnnTask, type Project } from "./data";
import { LABEL_STYLE } from "./doc";
import { CanvasToolbar, EditorCanvas, clampZ, type Tool, type View } from "./editor-canvas";
import { histReducer, seedDoc, validate, type Draft, type EdDoc, type Issue, type Region } from "./editor-model";
import { IssuesList, LeftPanel, RightPanel } from "./editor-panels";
import { ME } from "./data";
import { TaskStatusBadge, isKhmer, useQueryState } from "./shared";
import { useProjects, useTasks } from "./store";

const SHORTCUTS: Array<[string, string]> = [
  ["Ctrl + S", "Save now"], ["Ctrl + Z", "Undo"], ["Ctrl + Shift + Z  /  Ctrl + Y", "Redo"], ["Ctrl + Enter", "Submit for review"],
  ["[  /  ]", "Previous / next page"], ["J  /  K", "Next / previous region"], ["V  ·  B  ·  H", "Select · Draw · Pan tool"], ["+  /  −  /  0", "Zoom in · out · fit"],
  ["R", "Rotate page 90°"], ["Delete", "Delete selected region"], ["Esc", "Deselect region"], ["Space + drag", "Pan the page"], ["Ctrl + wheel", "Zoom"], ["?", "Show this dialog"]
];
const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

export function AnnotationEditor({ taskId }: { taskId: string }) {
  const loading = useFakeLoad(600);
  const { tasks, patchTasks } = useTasks();
  const { projects } = useProjects();
  const [draft, setDraft] = useDemoState<Draft | null>(`ann:draft:${taskId}`, null);
  const task = tasks.find((t) => t.id === taskId);
  const project = projects.find((p) => p.id === task?.projectId);
  if (loading) return <FocusShell title="Loading task…" backHref="/annotate/tasks"><div className="grid h-full grid-cols-[240px_1fr_380px] gap-px p-3"><Skeleton className="h-full" /><Skeleton className="mx-3 h-full" /><Skeleton className="h-full" /></div></FocusShell>;
  if (!task || !project) return <FocusShell title="Task not found" backHref="/annotate/tasks"><EmptyState title="Task not found" description={`No annotation task with ID ${taskId} exists.`} action={<Button href="/annotate/tasks" variant="outline">Back to my tasks</Button>} /></FocusShell>;
  if (task.assignee !== ME) return <FocusShell title={`${task.id} · No access`} backHref="/annotate/tasks"><EmptyState icon={AlertTriangle} title="This task is not assigned to you" description={`Only the active assignee can edit ${task.id}. It is currently ${task.assignee ? `assigned to ${task.assignee}` : "unassigned"}.`} action={<Button href="/annotate/tasks" variant="outline">Back to my tasks</Button>} /></FocusShell>;
  const locked = task.status === "submitted" || task.status === "in_review" || task.status === "approved";
  return <EditorInner key={task.id} task={task} project={project} tasks={tasks} draft={draft} setDraft={setDraft} patchTasks={patchTasks} locked={locked} />;
}

function EditorInner({ task, project, tasks, draft, setDraft, patchTasks, locked }: {
  task: AnnTask; project: Project; tasks: AnnTask[]; draft: Draft | null; setDraft: (d: Draft) => void; patchTasks: (ids: string[], p: Partial<AnnTask>) => void; locked: boolean;
}) {
  const { toast, confirm } = useUI();
  const router = useRouter();
  const [hist, dispatch] = useReducer(histReducer, undefined, () => ({ past: [], present: draft?.doc ?? seedDoc(task.pages), future: [] }));
  const doc = hist.present;
  const [pageQ, setPageQ] = useQueryState<string>("page", "1");
  const page = Math.min(task.pages - 1, Math.max(0, (parseInt(pageQ, 10) || 1) - 1));
  const [selectedId, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [view, setViewState] = useState<View>({ z: 1, rot: 0, px: 0, py: 0 });
  const setView = useCallback((f: (v: View) => View) => setViewState(f), []);
  const [fitTick, setFitTick] = useState(0);
  const [save, setSave] = useState<"saved" | "dirty" | "saving">("saved");
  const [savedAt, setSavedAt] = useState(draft?.savedAt ?? "Not saved yet");
  const [shortcuts, setShortcuts] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const savedDoc = useRef<EdDoc>(doc);
  const latest = useRef(doc); useEffect(() => { latest.current = doc; });

  const unresolved = task.feedback.filter((f) => !f.resolved).length;
  const issues = useMemo(() => validate(doc, task.pages, unresolved), [doc, task.pages, unresolved]);
  const errors = issues.filter((i) => i.level === "error").length;
  const pageRegions = useMemo(() => doc.regions.filter((r) => r.page === page), [doc.regions, page]);
  const siblings = tasks.filter((t) => t.assignee === ME && t.projectId === project.id).slice(0, 8);
  const progress = Math.round((doc.done.length / task.pages) * 100);

  const commit = useCallback((fn: (d: EdDoc) => EdDoc, key?: string) => { if (locked) return; dispatch({ type: "commit", next: fn(latest.current), key, t: Date.now() }); }, [locked]);
  const patchRegion = (id: string, p: Partial<Region>, key: string) => commit((d) => ({ ...d, regions: d.regions.map((r) => (r.id === id ? { ...r, ...p } : r)) }), key);

  /* ---- autosave (debounced) ---- */
  const doSave = useCallback(async (manual?: boolean) => {
    if (locked) return;
    setSave("saving"); await wait(300);
    const d = latest.current; const at = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setDraft({ doc: d, savedAt: at }); savedDoc.current = d; setSavedAt(at);
    patchTasks([task.id], { completion: Math.max(task.completion, Math.min(95, Math.round((d.done.length / task.pages) * 100) || 5)), updated: TODAY, ...(task.status === "assigned" ? { status: "in_progress" as const } : {}) });
    setSave(latest.current === d ? "saved" : "dirty");
    if (manual) toast("Draft saved");
  }, [locked, setDraft, patchTasks, task.id, task.completion, task.pages, task.status, toast]);
  useEffect(() => {
    if (doc === savedDoc.current) return;
    setSave((s) => (s === "saving" ? s : "dirty"));
    const t = setTimeout(() => { void doSave(); }, 1500);
    return () => clearTimeout(t);
  }, [doc, doSave]);
  useEffect(() => {
    if (save === "saved") return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [save]);

  /* ---- actions ---- */
  const goto = useCallback((p: number) => { setPageQ(String(Math.min(task.pages - 1, Math.max(0, p)) + 1)); setSelected(null); setFitTick((n) => n + 1); }, [setPageQ, task.pages]);
  const zoomBy = (f: number) => setView((v) => ({ ...v, z: clampZ(Math.round(v.z * f * 100) / 100) }));
  const rotate = () => { setView((v) => ({ ...v, rot: (v.rot + 90) % 360 })); setTimeout(() => setFitTick((n) => n + 1), 0); };
  const remove = useCallback((id: string) => { commit((d) => ({ ...d, regions: d.regions.filter((r) => r.id !== id) })); setSelected((s) => (s === id ? null : s)); }, [commit]);
  const stepRegion = (dir: 1 | -1) => { const rs = [...pageRegions].sort((a, b) => a.y - b.y || a.x - b.x); if (!rs.length) return; const i = rs.findIndex((r) => r.id === selectedId); setSelected(rs[(i + dir + rs.length) % rs.length].id); };
  const actions = {
    setText: (id: string, t: string) => patchRegion(id, { text: t }, `text:${id}`),
    setLabel: (id: string, l: string) => patchRegion(id, { label: l }, `label:${id}`),
    remove, revert: (id: string) => commit((d) => ({ ...d, regions: d.regions.map((r) => (r.id === id ? { ...r, text: r.ocr } : r)) })),
    setPageLabel: (l: string) => commit((d) => ({ ...d, pageLabels: { ...d.pageLabels, [page]: l } })),
    toggleFlag: (f: string) => commit((d) => ({ ...d, flags: d.flags.includes(f) ? d.flags.filter((x) => x !== f) : [...d.flags, f] })),
    setMeta: (p: Partial<EdDoc["meta"]>) => commit((d) => ({ ...d, meta: { ...d.meta, ...p } }), `meta:${Object.keys(p)[0]}`)
  };
  const toggleDone = (p: number) => commit((d) => ({ ...d, done: d.done.includes(p) ? d.done.filter((x) => x !== p) : [...d.done, p] }));
  const resolve = (id: string) => patchTasks([task.id], { feedback: task.feedback.map((f) => (f.id === id ? { ...f, resolved: !f.resolved } : f)) });
  const goIssue = (i: Issue) => { goto(i.page); if (i.regionId) setTimeout(() => setSelected(i.regionId!), 0); setIssuesOpen(false); };

  const submit = useCallback(async () => {
    if (locked) { toast("This task is already submitted.", "info"); return; }
    const l = latest.current; const iss = validate(l, task.pages, unresolved);
    const errs = iss.filter((i) => i.level === "error");
    if (errs.length) { setIssuesOpen(true); toast(`Fix ${errs.length} validation error${errs.length > 1 ? "s" : ""} before submitting.`, "error"); return; }
    const warns = iss.length;
    const ok = await confirm({ title: "Submit for review?", confirmLabel: "Submit task", description: `${task.id} · ${l.regions.length} regions across ${task.pages} page${task.pages > 1 ? "s" : ""}. ${warns ? `${warns} warning${warns > 1 ? "s" : ""} remain. ` : ""}You will not be able to edit it unless a reviewer requests corrections. Reward of $${task.reward.toFixed(2)} is paid on approval.` });
    if (!ok) return;
    setSubmitting(true); await doSave(); await wait(600);
    patchTasks([task.id], { status: "submitted", completion: 100, updated: TODAY, attempts: task.status === "corrections_requested" ? task.attempts : task.attempts });
    toast(`${task.id} submitted for review.`); router.push("/annotate/submitted");
  }, [locked, task, unresolved, confirm, doSave, patchTasks, toast, router]);

  /* ---- keyboard ---- */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.isComposing || e.key === "Process") return;
      const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
      if (mod && k === "s") { e.preventDefault(); void doSave(true); return; }
      if (mod && k === "z") { e.preventDefault(); dispatch({ type: e.shiftKey ? "redo" : "undo" }); return; }
      if (mod && k === "y") { e.preventDefault(); dispatch({ type: "redo" }); return; }
      if (mod && e.key === "Enter") { e.preventDefault(); void submit(); return; }
      if (mod || e.altKey || isField(e.target) || document.querySelector("dialog[open]")) return;
      if (e.key === "?") { e.preventDefault(); setShortcuts(true); }
      else if (e.key === "[") goto(page - 1);
      else if (e.key === "]") goto(page + 1);
      else if (k === "j") stepRegion(1);
      else if (k === "k") stepRegion(-1);
      else if (k === "v") setTool("select");
      else if (k === "b") setTool("draw");
      else if (k === "h") setTool("pan");
      else if (e.key === "+" || e.key === "=") zoomBy(1.2);
      else if (e.key === "-") zoomBy(1 / 1.2);
      else if (e.key === "0") setFitTick((n) => n + 1);
      else if (k === "r") rotate();
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); remove(selectedId); }
      else if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });

  const onCreate = (r: { x: number; y: number; w: number; h: number }) => {
    const id = `r-${page}-${Date.now().toString(36)}`;
    commit((d) => ({ ...d, regions: [...d.regions, { id, page, ...r, label: "Paragraph", text: "", ocr: "" }] }));
    setSelected(id); setTool("select");
  };

  const saveText = save === "saving" ? "Saving…" : save === "dirty" ? "Unsaved changes" : locked ? "Read-only" : `Saved ${savedAt}`;
  const actionsBar = (
    <div className="hidden items-center gap-1.5 lg:flex">
      <span role="status" aria-live="polite" className={cn("mr-1 flex items-center gap-1.5 text-xs", save === "dirty" ? "text-warning" : "text-muted")}>
        {save === "saving" ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={14} />}{saveText}</span>
      <Button variant="ghost" size="icon" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!hist.past.length || locked} onClick={() => dispatch({ type: "undo" })}><Undo2 size={16} /></Button>
      <Button variant="ghost" size="icon" aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" disabled={!hist.future.length || locked} onClick={() => dispatch({ type: "redo" })}><Redo2 size={16} /></Button>
      <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts (?)" title="Keyboard shortcuts (?)" onClick={() => setShortcuts(true)}><Keyboard size={16} /></Button>
      <Button size="sm" loading={submitting} disabled={locked} onClick={() => void submit()}><Send size={13} />Submit for review</Button>
    </div>
  );

  return (
    <FocusShell backHref={`/annotate/tasks/${task.id}`} actions={actionsBar}
      title={<span className="flex items-center gap-2"><span className="truncate">{project.name}</span><span className="text-muted">/</span><span className="tabular">{task.id}</span><span className="hidden xl:inline-flex"><TaskStatusBadge status={task.status} /></span></span>}>
      {/* Desktop editor */}
      <div className="hidden h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] lg:grid">
        <div className="grid min-h-0 grid-cols-[232px_minmax(0,1fr)_380px] xl:grid-cols-[256px_minmax(0,1fr)_400px]">
          <LeftPanel task={task} siblings={siblings} doc={doc} page={page} goto={goto} toggleDone={toggleDone} />
          <div className="flex min-h-0 min-w-0 flex-col">
            <CanvasToolbar tool={tool} setTool={setTool} view={view} zoomBy={zoomBy} fit={() => setFitTick((n) => n + 1)} rotate={rotate} page={page} total={task.pages} goto={goto} readOnly={locked} />
            {locked && <div className="border-b border-line bg-warning-soft px-3 py-1.5 text-xs text-warning">This task is {task.status.replace("_", " ")}: the editor is read-only.</div>}
            <div className="min-h-0 flex-1">
              <EditorCanvas page={page} total={task.pages} source={task.file} regions={pageRegions} selectedId={selectedId} tool={tool} view={view} setView={setView} fitTick={fitTick} readOnly={locked}
                onSelect={setSelected} onCreate={onCreate} onChange={(id, r) => patchRegion(id, r, `geo:${id}`)} />
            </div>
          </div>
          <RightPanel project={project} task={task} doc={doc} page={page} selectedId={selectedId} onSelect={setSelected} actions={actions} issues={issues} unresolved={unresolved} onResolve={resolve} />
        </div>
        {/* Status bar */}
        <div className="relative border-t border-line bg-surface">
          {issuesOpen && <div className="pop absolute bottom-full right-3 z-20 mb-2 w-[min(520px,90vw)] overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
            <div className="flex items-center justify-between border-b border-line px-3 py-2 text-sm font-semibold">Validation issues<Button variant="ghost" size="sm" onClick={() => setIssuesOpen(false)}>Close</Button></div>
            <IssuesList issues={issues} onGo={goIssue} /></div>}
          <div className="flex h-9 items-center gap-4 px-3 text-xs text-muted">
            <div className="flex w-56 items-center gap-2"><span className="shrink-0">Task progress</span><Progress value={progress} tone={progress === 100 ? "success" : "brand"} label="Task progress" /><span className="tabular w-8 text-right text-fg">{progress}%</span></div>
            <span className="tabular">Page {page + 1} of {task.pages} · source p.{task.page + page}</span>
            <span className="tabular">{pageRegions.length} regions</span>
            <span className="ml-auto flex items-center gap-1.5">{save === "saving" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} className={save === "dirty" ? "text-warning" : "text-success"} />}{save === "dirty" ? "Autosave in a moment…" : `Autosave on · ${saveText}`}</span>
            <button onClick={() => setIssuesOpen((o) => !o)} aria-expanded={issuesOpen} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface2">
              {errors ? <AlertCircle size={13} className="text-danger" /> : issues.length ? <AlertTriangle size={13} className="text-warning" /> : <CheckCircle2 size={13} className="text-success" />}
              <span className="text-fg">{issues.length === 0 ? "No issues" : `${errors} error${errors === 1 ? "" : "s"} · ${issues.length - errors} warning${issues.length - errors === 1 ? "" : "s"}`}</span>
            </button>
          </div>
        </div>
      </div>
      <MobileViewer task={task} project={project} doc={doc} />
      <Modal open={shortcuts} onClose={() => setShortcuts(false)} title="Keyboard shortcuts" description="Single-key shortcuts are disabled while typing in a field or composing Khmer text." width="max-w-lg">
        <dl className="divide-y divide-line">{SHORTCUTS.map(([k, d]) => <div key={k} className="flex items-center justify-between gap-4 py-2 text-sm"><dt className="text-muted">{d}</dt><dd><kbd className="rounded-md border border-line bg-surface2 px-2 py-0.5 font-mono text-xs">{k}</kbd></dd></div>)}</dl>
      </Modal>
    </FocusShell>
  );
}

/* ---------------- Mobile: simplified read-only viewer ---------------- */
function MobileViewer({ task, project, doc }: { task: AnnTask; project: Project; doc: EdDoc }) {
  const [page, setPage] = useState(0);
  const [view, setView] = useState<View>({ z: 0.6, rot: 0, px: 0, py: 0 });
  const [fit, setFit] = useState(0);
  const regions = doc.regions.filter((r) => r.page === page).sort((a, b) => a.y - b.y);
  return (
    <div className="flex h-full flex-col overflow-y-auto lg:hidden">
      <div className="space-y-3 p-3">
        <Alert tone="warning" title="Desktop recommended for annotation"><span className="flex items-start gap-2"><Monitor size={14} className="mt-0.5 shrink-0" />Drawing regions and editing Khmer transcription needs a larger screen (1024 px or wider). You can review the task here in read-only mode.</span></Alert>
        <div className="rounded-xl border border-line bg-surface p-3 text-sm"><div className="flex items-center justify-between gap-2"><p className="font-semibold">{project.name}</p><TaskStatusBadge status={task.status} /></div>
          <p className="mt-1 text-xs text-muted">{task.id} · {task.file} · pages {task.page}–{task.page + task.pages - 1} · ${task.reward.toFixed(2)}</p></div>
      </div>
      <div className="h-[420px] shrink-0 border-y border-line">
        <div className="flex h-full flex-col">
          <CanvasToolbar tool="pan" setTool={() => undefined} view={view} zoomBy={(f) => setView((v) => ({ ...v, z: clampZ(v.z * f) }))} fit={() => setFit((n) => n + 1)} rotate={() => setView((v) => ({ ...v, rot: (v.rot + 90) % 360 }))} page={page} total={task.pages} goto={setPage} readOnly />
          <div className="min-h-0 flex-1"><EditorCanvas page={page} total={task.pages} source={task.file} regions={regions} selectedId={null} tool="pan" view={view} setView={(f) => setView(f)} fitTick={fit} onSelect={() => undefined} onCreate={() => undefined} onChange={() => undefined} readOnly /></div>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <p className="text-sm font-semibold">Transcription (read-only)</p>
        {regions.length === 0 ? <p className="text-sm text-muted">No regions on this page.</p> : regions.map((r, i) => (
          <div key={r.id} className="rounded-lg border border-line bg-surface p-3"><div className="mb-1 flex items-center gap-2 text-xs text-muted"><span className={cn("h-2 w-2 rounded-sm", (LABEL_STYLE[r.label] ?? LABEL_STYLE.Paragraph).dot)} />Line {i + 1} · {r.label}</div><p className={cn("whitespace-pre-wrap text-sm", isKhmer(r.text) && "khmer")}>{r.text || <span className="text-muted">(empty)</span>}</p></div>
        ))}
        <Button href={`/annotate/tasks/${task.id}`} variant="outline" className="w-full">Back to task details</Button>
        <Link href="/annotate/tasks" className="block py-2 text-center text-sm text-muted hover:text-fg">All my tasks</Link>
        <Badge tone="neutral">Read-only on this screen size</Badge>
      </div>
    </div>
  );
}
