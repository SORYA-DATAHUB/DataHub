"use client";
import { ChevronLeft, ChevronRight, Hand, Maximize, MousePointer2, RotateCw, Square, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DocPage, LABEL_STYLE, PAGE_H, PAGE_W } from "./doc";
import type { Region } from "./editor-model";

export type View = { z: number; rot: number; px: number; py: number };
export type Tool = "select" | "draw" | "pan";
type Rect = { x: number; y: number; w: number; h: number };
const MIN_Z = 0.25, MAX_Z = 3;
export const clampZ = (z: number) => Math.min(MAX_Z, Math.max(MIN_Z, z));

type Drag =
  | { kind: "pan"; sx: number; sy: number; px: number; py: number }
  | { kind: "draw"; start: { x: number; y: number } }
  | { kind: "move"; id: string; start: { x: number; y: number }; orig: Rect }
  | { kind: "resize"; id: string; start: { x: number; y: number }; orig: Rect };

export function CanvasToolbar({ tool, setTool, view, zoomBy, fit, rotate, page, total, goto, readOnly }: {
  tool: Tool; setTool: (t: Tool) => void; view: View; zoomBy: (f: number) => void; fit: () => void; rotate: () => void; page: number; total: number; goto: (p: number) => void; readOnly?: boolean;
}) {
  const tools: Array<{ id: Tool; icon: typeof Hand; label: string; key: string }> = [{ id: "select", icon: MousePointer2, label: "Select / move region", key: "V" }, { id: "draw", icon: Square, label: "Draw text region", key: "B" }, { id: "pan", icon: Hand, label: "Pan page", key: "H" }];
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface px-2 py-1.5" role="toolbar" aria-label="Canvas tools">
      {!readOnly && <div className="flex gap-0.5 rounded-lg bg-surface2 p-0.5">
        {tools.map((t) => (
          <button key={t.id} type="button" onClick={() => setTool(t.id)} aria-pressed={tool === t.id} aria-label={`${t.label} (${t.key})`} title={`${t.label} (${t.key})`}
            className={cn("flex h-7 w-7 items-center justify-center rounded-md", tool === t.id ? "bg-surface text-brand shadow-card" : "text-muted hover:text-fg")}><t.icon size={15} /></button>
        ))}
      </div>}
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Zoom out (-)" title="Zoom out (-)" onClick={() => zoomBy(1 / 1.2)}><ZoomOut size={15} /></Button>
      <span className="tabular w-11 text-center text-xs text-muted" aria-live="polite">{Math.round(view.z * 100)}%</span>
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Zoom in (+)" title="Zoom in (+)" onClick={() => zoomBy(1.2)}><ZoomIn size={15} /></Button>
      <Button variant="ghost" size="sm" className="h-7 px-2" title="Fit page (0)" onClick={fit}><Maximize size={13} />Fit</Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Rotate 90° (R)" title="Rotate 90° (R)" onClick={rotate}><RotateCw size={15} /></Button>
      <span className="tabular text-xs text-muted">{view.rot}°</span>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Previous page ([)" title="Previous page ([)" disabled={page <= 0} onClick={() => goto(page - 1)}><ChevronLeft size={15} /></Button>
        <span className="tabular text-xs">Page {page + 1} / {total}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Next page (])" title="Next page (])" disabled={page >= total - 1} onClick={() => goto(page + 1)}><ChevronRight size={15} /></Button>
      </div>
    </div>
  );
}

export function EditorCanvas({ page, total, source, regions, selectedId, tool, view, setView, fitTick, onSelect, onCreate, onChange, readOnly }: {
  page: number; total: number; source: string; regions: Region[]; selectedId: string | null; tool: Tool; view: View; setView: (f: (v: View) => View) => void; fitTick: number;
  onSelect: (id: string | null) => void; onCreate: (r: Rect) => void; onChange: (id: string, r: Rect) => void; readOnly?: boolean;
}) {
  const vp = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [ghost, setGhost] = useState<Rect | null>(null);
  const [space, setSpace] = useState(false);
  const viewRef = useRef(view); viewRef.current = view;

  const fit = useCallback(() => {
    const el = vp.current; if (!el || !el.clientWidth) return;
    const sw = viewRef.current.rot % 180 !== 0;
    const z = clampZ(Math.min((el.clientWidth - 56) / (sw ? PAGE_H : PAGE_W), (el.clientHeight - 56) / (sw ? PAGE_W : PAGE_H)));
    setView((v) => ({ ...v, z: Math.round(z * 100) / 100, px: 0, py: 0 }));
  }, [setView]);
  useEffect(() => { const t = setTimeout(fit, 0); return () => clearTimeout(t); }, [fitTick, fit]);
  useEffect(() => { const el = vp.current; if (!el) return; let first = true; const ro = new ResizeObserver(() => { if (first) { first = false; return; } fit(); }); ro.observe(el); return () => ro.disconnect(); }, [fit]);

  useEffect(() => {
    const el = vp.current; if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) setView((v) => ({ ...v, z: clampZ(v.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)) }));
      else setView((v) => ({ ...v, px: v.px - e.deltaX, py: v.py - e.deltaY }));
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, [setView]);
  useEffect(() => {
    const dn = (e: KeyboardEvent) => { if (e.code === "Space" && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) { setSpace(true); if (e.target === document.body || vp.current?.contains(e.target as Node)) e.preventDefault(); } };
    const up = (e: KeyboardEvent) => e.code === "Space" && setSpace(false);
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  const toDoc = (cx: number, cy: number) => {
    const r = pageRef.current!.getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    const a = (-view.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return { x: PAGE_W / 2 + (dx * c - dy * s) / view.z, y: PAGE_H / 2 + (dx * s + dy * c) / view.z };
  };
  const clampRect = (r: Rect): Rect => { const w = Math.max(16, Math.min(r.w, PAGE_W)), h = Math.max(16, Math.min(r.h, PAGE_H)); return { w, h, x: Math.min(Math.max(0, r.x), PAGE_W - w), y: Math.min(Math.max(0, r.y), PAGE_H - h) }; };

  const down = (e: RPointerEvent) => {
    if (e.button === 2) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (e.button === 1 || tool === "pan" || space || readOnly || tool === "select") {
      if (tool === "select" && !space && e.button !== 1 && !readOnly) onSelect(null);
      drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, px: view.px, py: view.py }; return;
    }
    if (tool === "draw") { onSelect(null); drag.current = { kind: "draw", start: toDoc(e.clientX, e.clientY) }; }
  };
  const regionDown = (e: RPointerEvent, r: Region, resize: boolean) => {
    if (readOnly || tool === "draw" || tool === "pan" || space) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onSelect(r.id);
    const o = { x: r.x, y: r.y, w: r.w, h: r.h };
    drag.current = { kind: resize ? "resize" : "move", id: r.id, start: toDoc(e.clientX, e.clientY), orig: o };
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current; if (!d) return;
    if (d.kind === "pan") { setView((v) => ({ ...v, px: d.px + e.clientX - d.sx, py: d.py + e.clientY - d.sy })); return; }
    const p = toDoc(e.clientX, e.clientY);
    if (d.kind === "draw") setGhost({ x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) });
    else if (d.kind === "move") onChange(d.id, clampRect({ ...d.orig, x: d.orig.x + p.x - d.start.x, y: d.orig.y + p.y - d.start.y }));
    else onChange(d.id, clampRect({ ...d.orig, w: d.orig.w + p.x - d.start.x, h: d.orig.h + p.y - d.start.y }));
  };
  const up = () => {
    const d = drag.current; drag.current = null;
    if (d?.kind === "draw" && ghost && ghost.w > 14 && ghost.h > 10) onCreate(clampRect(ghost));
    setGhost(null);
  };

  const cursor = readOnly || tool === "pan" || space ? "cursor-grab" : tool === "draw" ? "cursor-crosshair" : "cursor-default";
  const inv = 1 / view.z;
  return (
    <div ref={vp} className={cn("relative h-full w-full touch-none overflow-hidden bg-surface2", cursor)} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      role="application" aria-label="Document canvas. Use the transcription panel for keyboard editing.">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "18px 18px" }} aria-hidden />
      <div ref={pageRef} className="absolute" style={{ left: "50%", top: "50%", width: PAGE_W, height: PAGE_H, marginLeft: -PAGE_W / 2, marginTop: -PAGE_H / 2, transform: `translate(${view.px}px, ${view.py}px) rotate(${view.rot}deg) scale(${view.z})` }}>
        <DocPage page={page} total={total} source={source} />
        <div className="absolute inset-0">
          {regions.map((r, i) => {
            const st = LABEL_STYLE[r.label] ?? LABEL_STYLE.Paragraph; const sel = r.id === selectedId;
            return (
              <div key={r.id} onPointerDown={(e) => regionDown(e, r, false)} onClick={(e) => { e.stopPropagation(); if (readOnly || tool === "select") onSelect(r.id); }}
                className={cn("absolute border", st.box, sel && "ring-2 ring-brand ring-offset-1", !readOnly && tool === "select" ? "cursor-move" : "")}
                style={{ left: r.x, top: r.y, width: r.w, height: r.h, borderWidth: Math.max(1, 1.5 * inv), borderStyle: sel ? "solid" : "dashed" }} data-region={r.id}>
                <span className={cn("absolute left-0 top-0 origin-bottom-left whitespace-nowrap rounded-sm px-1 font-semibold leading-4", st.chip)} style={{ fontSize: 11, transform: `translateY(-100%) scale(${inv})` }}>{i + 1} · {r.label}</span>
                {sel && !readOnly && <span onPointerDown={(e) => regionDown(e, r, true)} className="absolute -bottom-1 -right-1 cursor-nwse-resize rounded-sm border border-brand bg-surface" style={{ width: 10 * inv, height: 10 * inv }} aria-hidden />}
              </div>
            );
          })}
          {ghost && <div className="absolute border-brand bg-brand/10" style={{ left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h, borderWidth: 1.5 * inv, borderStyle: "dashed" }} />}
        </div>
      </div>
    </div>
  );
}
