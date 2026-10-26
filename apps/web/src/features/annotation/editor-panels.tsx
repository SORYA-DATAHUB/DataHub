"use client";
import { AlertCircle, AlertTriangle, Check, CheckCircle2, MessageSquare, Plus, RotateCcw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/overlays";
import { Badge, EmptyState, Input, Select, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { DocPage, LABELS, LABEL_STYLE, PAGE_H, PAGE_W } from "./doc";
import type { AnnTask, Project } from "./data";
import { FLAGS, PAGE_LABELS, type EdDoc, type Issue, type Region } from "./editor-model";
import { TaskStatusBadge, isKhmer } from "./shared";

/* ---------------- Left: tasks + page thumbnails ---------------- */
export function LeftPanel({ task, siblings, doc, page, goto, toggleDone }: { task: AnnTask; siblings: AnnTask[]; doc: EdDoc; page: number; goto: (p: number) => void; toggleDone: (p: number) => void }) {
  const total = task.pages;
  const S = 0.19;
  return (
    <div className="flex h-full min-h-0 flex-col border-r border-line bg-surface">
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Pages in this task</p>
        <ol className="grid grid-cols-2 gap-2">
          {Array.from({ length: total }, (_, p) => {
            const n = doc.regions.filter((r) => r.page === p).length; const isDone = doc.done.includes(p);
            return (
              <li key={p}>
                <button onClick={() => goto(p)} aria-current={p === page ? "page" : undefined} aria-label={`Go to page ${p + 1}, ${n} regions${isDone ? ", done" : ""}`}
                  className={cn("group relative block w-full overflow-hidden rounded-lg border p-1.5 text-left transition-colors", p === page ? "border-brand bg-brand-soft" : "border-line hover:bg-surface2")}>
                  <div className="mx-auto overflow-hidden rounded-sm" style={{ width: PAGE_W * S, height: PAGE_H * S }}>
                    <div style={{ transform: `scale(${S})`, transformOrigin: "top left", width: PAGE_W, height: PAGE_H }}><DocPage page={p} total={total} source={task.file} /></div>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]"><span className="font-medium">p.{task.page + p}</span><span className="text-muted">{n} regions</span></div>
                  {isDone && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-success text-white"><Check size={12} /></span>}
                </button>
              </li>
            );
          })}
        </ol>
        <Button variant={doc.done.includes(page) ? "secondary" : "outline"} size="sm" className="mt-3 w-full" onClick={() => toggleDone(page)}>
          <CheckCircle2 size={14} />{doc.done.includes(page) ? "Page marked done" : "Mark page done"}
        </Button>
        <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted">My tasks in project</p>
        <ul className="space-y-1">
          {siblings.length === 0 && <li className="text-xs text-muted">No other assigned tasks.</li>}
          {siblings.map((t) => (
            <li key={t.id}>
              <Link href={`/annotate/tasks/${t.id}/edit`} aria-current={t.id === task.id ? "page" : undefined}
                className={cn("block rounded-lg px-2.5 py-2 text-xs transition-colors", t.id === task.id ? "bg-brand-soft text-brand" : "hover:bg-surface2")}>
                <span className="flex items-center justify-between gap-2 font-medium"><span>{t.id}</span><TaskStatusBadge status={t.status} /></span>
                <span className="mt-0.5 block truncate text-muted">{t.file} · p.{t.page}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Right: tabs ---------------- */
type TabId = "text" | "labels" | "meta" | "help" | "feedback";
export function RightPanel({ project, task, doc, page, selectedId, onSelect, actions, issues, unresolved, onResolve }: {
  project: Project; task: AnnTask; doc: EdDoc; page: number; selectedId: string | null; onSelect: (id: string | null) => void; issues: Issue[]; unresolved: number;
  actions: { setText: (id: string, t: string) => void; setLabel: (id: string, l: string) => void; remove: (id: string) => void; revert: (id: string) => void; setPageLabel: (l: string) => void; toggleFlag: (f: string) => void; setMeta: (p: Partial<EdDoc["meta"]>) => void };
  onResolve: (id: string) => void;
}) {
  const [tab, setTab] = useState<TabId>("text");
  useEffect(() => { if (selectedId) setTab((t) => (t === "labels" || t === "meta" || t === "help" || t === "feedback" ? "text" : t)); }, [selectedId]);
  return (
    <div className="flex h-full min-h-0 flex-col border-l border-line bg-surface">
      <Tabs<TabId> value={tab} onChange={setTab} tabs={[{ id: "text", label: "Text" }, { id: "labels", label: "Labels" }, { id: "meta", label: "Metadata" }, { id: "help", label: "Guide" }, { id: "feedback", label: "Feedback", count: task.feedback.length || undefined }]} />
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-3" role="tabpanel">
        {tab === "text" && <Transcription regions={doc.regions.filter((r) => r.page === page).sort((a, b) => a.y - b.y || a.x - b.x)} selectedId={selectedId} onSelect={onSelect} actions={actions} issues={issues} />}
        {tab === "labels" && <LabelsTab doc={doc} page={page} project={project} actions={actions} />}
        {tab === "meta" && <MetaTab doc={doc} actions={actions} />}
        {tab === "help" && <GuideTab project={project} task={task} />}
        {tab === "feedback" && <FeedbackTab task={task} onSelect={(i) => { const r = doc.regions.filter((x) => x.page === page).sort((a, b) => a.y - b.y || a.x - b.x)[i - 1]; if (r) { onSelect(r.id); setTab("text"); } }} unresolved={unresolved} onResolve={onResolve} />}
      </div>
    </div>
  );
}

function Transcription({ regions, selectedId, onSelect, actions, issues }: { regions: Region[]; selectedId: string | null; onSelect: (id: string | null) => void; actions: Parameters<typeof RightPanel>[0]["actions"]; issues: Issue[] }) {
  const refs = useRef<Record<string, HTMLLIElement | null>>({});
  useEffect(() => { if (selectedId) refs.current[selectedId]?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [selectedId]);
  if (regions.length === 0) return <EmptyState title="No text regions on this page" description="Choose the Draw tool (B) and drag over a block of text on the page to create a region." />;
  return (
    <ul className="space-y-2.5">
      {regions.map((r, i) => {
        const st = LABEL_STYLE[r.label] ?? LABEL_STYLE.Paragraph; const sel = r.id === selectedId; const empty = !r.text.trim(); const changed = r.text !== r.ocr;
        const issue = issues.find((x) => x.regionId === r.id);
        return (
          <li key={r.id} ref={(el) => { refs.current[r.id] = el; }} onClick={() => onSelect(r.id)} className={cn("rounded-lg border p-2.5 transition-colors", sel ? "border-brand bg-brand-soft/40 ring-1 ring-brand" : "border-line hover:border-muted/50")}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className={cn("flex h-5 min-w-5 items-center justify-center rounded px-1 text-[11px] font-semibold", st.chip)}>{i + 1}</span>
              <Select aria-label={`Label for line ${i + 1}`} className="h-7 flex-1 text-xs" value={r.label} onChange={(e) => actions.setLabel(r.id, e.target.value)} onClick={(e) => e.stopPropagation()}>{LABELS.map((l) => <option key={l}>{l}</option>)}</Select>
              {changed && <Badge tone="brand">Edited</Badge>}
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Restore OCR text for line ${i + 1}`} title="Restore OCR text" disabled={!changed} onClick={(e) => { e.stopPropagation(); actions.revert(r.id); }}><RotateCcw size={13} /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-danger" aria-label={`Delete region ${i + 1}`} onClick={(e) => { e.stopPropagation(); actions.remove(r.id); }}><Trash2 size={13} /></Button>
            </div>
            <Textarea aria-label={`Transcription for line ${i + 1}`} aria-invalid={empty} lang={isKhmer(r.text) ? "km" : undefined} spellCheck={false} value={r.text} rows={Math.min(6, Math.max(2, r.text.split("\n").length + Math.floor(r.text.length / 42)))}
              onFocus={() => onSelect(r.id)} onChange={(e) => actions.setText(r.id, e.target.value)} placeholder="Type exactly what is printed. Use [illegible] for unreadable words."
              className={cn("min-h-14 resize-y py-1.5 text-sm leading-relaxed", isKhmer(r.text) && "khmer text-[15px]")} />
            <div className="mt-1 flex justify-between text-[11px] text-muted"><span>{issue ? <span className="text-danger">Empty transcription</span> : `${[...r.text].length} characters`}</span><span>{isKhmer(r.text) ? "Khmer" : "Latin"}</span></div>
          </li>
        );
      })}
    </ul>
  );
}

function LabelsTab({ doc, page, project, actions }: { doc: EdDoc; page: number; project: Project; actions: Parameters<typeof RightPanel>[0]["actions"] }) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Page classification</legend>
        <div className="space-y-1.5">
          {PAGE_LABELS.map((l) => (
            <label key={l} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm", doc.pageLabels[page] === l ? "border-brand bg-brand-soft" : "border-line hover:bg-surface2")}>
              <input type="radio" name={`pl-${page}`} checked={doc.pageLabels[page] === l} onChange={() => actions.setPageLabel(l)} />{l}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Page flags</legend>
        <div className="space-y-1.5">{FLAGS.map((f) => (
          <label key={f} className="flex cursor-pointer items-center gap-2.5 text-sm"><input type="checkbox" checked={doc.flags.includes(f)} onChange={() => actions.toggleFlag(f)} />{f}</label>
        ))}</div>
      </fieldset>
      <div>
        <p className="mb-2 text-sm font-semibold">Region label legend</p>
        <ul className="grid grid-cols-2 gap-1.5 text-xs">{LABELS.filter((l) => project.labels.includes(l)).map((l) => <li key={l} className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-sm", LABEL_STYLE[l].dot)} />{l}</li>)}</ul>
      </div>
    </div>
  );
}

function MetaTab({ doc, actions }: { doc: EdDoc; actions: Parameters<typeof RightPanel>[0]["actions"] }) {
  const [tag, setTag] = useState("");
  const add = () => { const t = tag.trim().toLowerCase(); if (t && !doc.meta.tags.includes(t)) actions.setMeta({ tags: [...doc.meta.tags, t] }); setTag(""); };
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="mt" className="mb-1.5 block text-sm font-medium">Tags</label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {doc.meta.tags.length === 0 && <span className="text-xs text-muted">No tags yet.</span>}
          {doc.meta.tags.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-surface2 py-0.5 pl-2.5 pr-1 text-xs">{t}<button aria-label={`Remove tag ${t}`} className="rounded-full p-0.5 hover:bg-line" onClick={() => actions.setMeta({ tags: doc.meta.tags.filter((x) => x !== t) })}><X size={11} /></button></span>)}
        </div>
        <div className="flex gap-2"><Input id="mt" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Add a tag and press Enter" /><Button variant="outline" size="icon" aria-label="Add tag" onClick={add}><Plus size={14} /></Button></div>
      </div>
      <div><label htmlFor="ml" className="mb-1.5 block text-sm font-medium">Language</label>
        <Select id="ml" value={doc.meta.language} onChange={(e) => actions.setMeta({ language: e.target.value })}>{["Khmer", "English", "Khmer + English", "Other"].map((l) => <option key={l}>{l}</option>)}</Select></div>
      <div><label htmlFor="mg" className="mb-1.5 block text-sm font-medium">Legibility</label>
        <Select id="mg" value={doc.meta.legibility} onChange={(e) => actions.setMeta({ legibility: e.target.value })}><option value="">Select…</option>{["Excellent", "Good", "Fair", "Poor"].map((l) => <option key={l}>{l}</option>)}</Select></div>
      <div><label htmlFor="mn" className="mb-1.5 block text-sm font-medium">Notes for reviewer</label>
        <Textarea id="mn" value={doc.meta.notes} onChange={(e) => actions.setMeta({ notes: e.target.value })} placeholder="e.g. Bottom two lines torn; marked [illegible]." className="khmer" /></div>
    </div>
  );
}

function GuideTab({ project, task }: { project: Project; task: AnnTask }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg bg-surface2 p-3 text-xs"><p className="font-semibold">{project.name}</p><p className="mt-0.5 text-muted">{project.type} · reward ${task.reward.toFixed(2)} · due {task.deadline}</p></div>
      <ol className="space-y-2">{project.instructions.split("\n").filter(Boolean).map((l, i) => <li key={i} className="khmer leading-relaxed">{l}</li>)}</ol>
      <div className="rounded-lg border border-line p-3 text-xs text-muted">Shortcuts: press <kbd className="rounded border border-line px-1">?</kbd> for the full list.</div>
    </div>
  );
}

function FeedbackTab({ task, onSelect, unresolved, onResolve }: { task: AnnTask; onSelect: (n: number) => void; unresolved: number; onResolve: (id: string) => void }) {
  if (task.feedback.length === 0) return <EmptyState icon={MessageSquare} title="No reviewer feedback" description="If a reviewer requests corrections, their comments appear here with links to the lines they refer to." />;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{unresolved} unresolved of {task.feedback.length}. Resolve each comment after you have fixed it.</p>
      {task.feedback.map((f) => (
        <div key={f.id} className={cn("rounded-lg border p-3 text-sm", f.resolved ? "border-line opacity-70" : "border-warning/40 bg-warning-soft")}>
          <div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium">{f.author}</span><span className="text-muted">{f.at}</span></div>
          <p className="khmer">{f.text}</p>
          <div className="mt-2 flex gap-2">
            {f.region && <Button variant="outline" size="sm" onClick={() => onSelect(f.region!)}>Go to line {f.region}</Button>}
            <Button variant={f.resolved ? "ghost" : "secondary"} size="sm" onClick={() => onResolve(f.id)}>{f.resolved ? "Reopen" : "Mark resolved"}</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Issues list ---------------- */
export function IssuesList({ issues, onGo }: { issues: Issue[]; onGo: (i: Issue) => void }) {
  if (issues.length === 0) return <p className="flex items-center gap-2 p-3 text-sm text-success"><CheckCircle2 size={16} />No validation issues. Ready to submit.</p>;
  return (
    <ul className="max-h-56 divide-y divide-line overflow-y-auto scroll-thin">
      {issues.map((i) => (
        <li key={i.id}><button onClick={() => onGo(i)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-surface2">
          {i.level === "error" ? <AlertCircle size={15} className="shrink-0 text-danger" /> : <AlertTriangle size={15} className="shrink-0 text-warning" />}
          <span className="flex-1">{i.text}</span><span className="text-xs text-muted">Go to</span></button></li>
      ))}
    </ul>
  );
}
