import { blocksFor, yShift } from "./doc";

export type Region = { id: string; page: number; x: number; y: number; w: number; h: number; label: string; text: string; ocr: string };
export type EdDoc = {
  regions: Region[];
  pageLabels: Record<number, string>;
  flags: string[];
  meta: { tags: string[]; language: string; legibility: string; notes: string };
  done: number[];
};
export type Draft = { doc: EdDoc; savedAt: string };

export const PAGE_LABELS = ["Gazette body page", "Cover / title page", "Table page", "Blank page", "Illustration / stamp only"];
export const FLAGS = ["Contains stamp or seal", "Handwriting present", "Damaged or torn page", "Needs second review"];

export function seedDoc(pages: number): EdDoc {
  const regions: Region[] = [];
  for (let p = 0; p < pages; p++) for (const b of blocksFor(p)) regions.push({ id: `r-${p}-${b.id}`, page: p, x: b.x - 4, y: b.y + yShift(b, p) - 4, w: b.w + 8, h: b.h + 8, label: b.label, text: b.ocr, ocr: b.ocr });
  return { regions, pageLabels: {}, flags: [], meta: { tags: ["gazette", "1996"], language: "Khmer + English", legibility: "Good", notes: "" }, done: [] };
}

export type Issue = { id: string; level: "error" | "warning"; page: number; regionId?: string; text: string };
export function validate(doc: EdDoc, pages: number, unresolved: number): Issue[] {
  const out: Issue[] = [];
  for (let p = 0; p < pages; p++) {
    const rs = doc.regions.filter((r) => r.page === p);
    if (rs.length === 0) out.push({ id: `np${p}`, level: "error", page: p, text: `Page ${p + 1}: no text regions drawn` });
    if (!doc.pageLabels[p]) out.push({ id: `pl${p}`, level: "warning", page: p, text: `Page ${p + 1}: page label not selected` });
    rs.forEach((r) => { if (!r.text.trim()) out.push({ id: `e${r.id}`, level: "error", page: p, regionId: r.id, text: `Page ${p + 1}: region has empty transcription` }); });
  }
  if (!doc.meta.legibility) out.push({ id: "meta", level: "warning", page: 0, text: "Metadata: legibility not set" });
  if (unresolved > 0) out.push({ id: "fb", level: "warning", page: 0, text: `${unresolved} reviewer comment${unresolved > 1 ? "s" : ""} not marked as resolved` });
  return out;
}

/* ---------- Undo / redo history ---------- */
export type Hist = { past: EdDoc[]; present: EdDoc; future: EdDoc[]; key?: string; t?: number };
export type HistAction = { type: "commit"; next: EdDoc; key?: string; t: number } | { type: "undo" } | { type: "redo" } | { type: "reset"; doc: EdDoc };
const LIMIT = 100;
export function histReducer(h: Hist, a: HistAction): Hist {
  switch (a.type) {
    case "commit": {
      if (a.next === h.present) return h;
      // coalesce rapid edits of the same field into one undo step
      if (a.key && h.key === a.key && h.t !== undefined && a.t - h.t < 900) return { ...h, present: a.next, future: [], t: a.t };
      return { past: [...h.past, h.present].slice(-LIMIT), present: a.next, future: [], key: a.key, t: a.t };
    }
    case "undo": return h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], key: undefined } : h;
    case "redo": return h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), key: undefined } : h;
    case "reset": return { past: [], present: a.doc, future: [] };
  }
}
