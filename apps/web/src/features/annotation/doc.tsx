"use client";
import { cn } from "@/lib/cn";

/* The mock "scanned" page. Paper/ink colours are document artwork (not UI chrome), so they are intentionally theme-independent. */
export const PAGE_W = 595;
export const PAGE_H = 842;

export type Block = { id: string; x: number; y: number; w: number; h: number; size: number; align?: "left" | "center"; bold?: boolean; km?: boolean; truth: string; ocr: string; label: string; first?: boolean; stamp?: boolean; table?: boolean; tilt: number };

export const BLOCKS: Block[] = [
  { id: "title", x: 48, y: 50, w: 499, h: 44, size: 26, align: "center", km: true, truth: "ព្រះរាជាណាចក្រកម្ពុជា", ocr: "ព្រះរាជាណាចក្រកម្ពុជា", label: "Heading", first: true, tilt: -0.2 },
  { id: "sub", x: 48, y: 98, w: 499, h: 32, size: 16, align: "center", km: true, truth: "ជាតិ សាសនា ព្រះមហាក្សត្រ", ocr: "ជាតិ សាសនា ព្រះមហាក្សត្", label: "Heading", first: true, tilt: 0.15 },
  { id: "hdr", x: 48, y: 142, w: 499, h: 24, size: 11, align: "center", bold: true, truth: "MINISTRY OF JUSTICE — OFFICIAL GAZETTE No. 034", ocr: "MINISTRY OF JUSTlCE - OFFICIAL GAZETTE No. 034", label: "Heading", first: true, tilt: 0.1 },
  { id: "p1", x: 48, y: 184, w: 499, h: 62, size: 15, km: true, truth: "ក្រសួងយុត្តិធម៌ ប្រកាសលេខ ០៣៤ ស្តីពីការរៀបចំបញ្ជីអត្រានុកូលដ្ឋាន។", ocr: "ក្រសួងយុត្តិធម៌ ប្រកាសលេខ ០៣៤ ស្តីពីការរៀបចំបញ្ជីអត្រានុកូលដាន។", label: "Paragraph", tilt: -0.3 },
  { id: "p2", x: 48, y: 258, w: 499, h: 52, size: 12, truth: "Pursuant to the Law on Civil Status, the registry shall be maintained in every commune and updated each quarter.", ocr: "Pursuant to the Law on Civil Status, the registry shall be maintained in every comune and updated each quarter.", label: "Paragraph", tilt: 0.2 },
  { id: "p3", x: 48, y: 324, w: 499, h: 62, size: 15, km: true, truth: "រាល់ការចុះបញ្ជីត្រូវធ្វើឡើងក្នុងរយៈពេលសាមសិបថ្ងៃ គិតចាប់ពីថ្ងៃកើតហេតុ។", ocr: "រាល់ការចុះបញ្ជីត្រូវធ្វើឡើងក្នុងរយៈពេលសាមសិបថ្ងៃ គិតចាប់ពីថ្ងៃកើតហេតុ", label: "Paragraph", tilt: -0.1 },
  { id: "p4", x: 48, y: 398, w: 499, h: 40, size: 12, truth: "Article 4. Every birth shall be declared within thirty days of the event.", ocr: "Artic1e 4. Every birth shall be declared within thirty days of the event.", label: "Paragraph", tilt: 0.25 },
  { id: "tbl", x: 48, y: 456, w: 300, h: 96, size: 11, table: true, truth: "No. | Commune | Births\n1 | Chamkar Mon | 142\n2 | Daun Penh | 98\n3 | Tuol Kork | 117", ocr: "No. | Commune | Births\n1 | Chamkar Mon | 142\n2 | Daun Penh | 98\n3 | Tuol Kork | 117", label: "Table", tilt: 0.1 },
  { id: "stamp", x: 392, y: 456, w: 155, h: 96, size: 13, align: "center", stamp: true, km: true, truth: "ក្រសួងយុត្តិធម៌", ocr: "ក្រសួងយុត្តិធម", label: "Stamp", tilt: -8 },
  { id: "sig", x: 48, y: 580, w: 320, h: 28, size: 11, truth: "Phnom Penh, 12 March 1996 · Minister of Justice", ocr: "Phnom Penh, 12 March 1996 · Minister of Justice", label: "Signature", tilt: -0.2 }
];
export const LABELS = ["Heading", "Paragraph", "Table", "Stamp", "Signature", "Footnote"] as const;
/** Static class strings (Tailwind must see them). */
export const LABEL_STYLE: Record<string, { box: string; chip: string; dot: string }> = {
  Heading: { box: "border-brand bg-brand/10", chip: "bg-brand text-white", dot: "bg-brand" },
  Paragraph: { box: "border-success bg-success/10", chip: "bg-success text-white", dot: "bg-success" },
  Table: { box: "border-warning bg-warning/10", chip: "bg-warning text-white", dot: "bg-warning" },
  Stamp: { box: "border-danger bg-danger/10", chip: "bg-danger text-white", dot: "bg-danger" },
  Signature: { box: "border-fg bg-fg/10", chip: "bg-fg text-bg", dot: "bg-fg" },
  Footnote: { box: "border-muted bg-muted/10", chip: "bg-muted text-bg", dot: "bg-muted" }
};
export const blocksFor = (page: number) => BLOCKS.filter((b) => page === 0 || !b.first);
/** Continuation pages drop the header and move content up. */
export const yShift = (b: Block, page: number) => (page === 0 || b.first ? 0 : -130);

const NOISE = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .3  0 0 0 0 .2  0 0 0 .16 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function DocPage({ page, total, source, className }: { page: number; total: number; source?: string; className?: string }) {
  return (
    <div className={cn("relative select-none overflow-hidden", className)} style={{ width: PAGE_W, height: PAGE_H, background: "#f4efe1", color: "#2a2924", boxShadow: "0 8px 30px rgb(0 0 0 / .25)" }}>
      <div className="absolute inset-0" style={{ backgroundImage: NOISE, mixBlendMode: "multiply" }} aria-hidden />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 20% 10%, rgb(255 255 255 / .35), transparent 55%), radial-gradient(ellipse at 100% 100%, rgb(120 90 40 / .22), transparent 60%)" }} aria-hidden />
      <div className="absolute left-0 top-0 h-full w-3" style={{ background: "linear-gradient(90deg, rgb(60 40 10 / .18), transparent)" }} aria-hidden />
      {blocksFor(page).map((b) => (
        <div key={b.id} className={cn("absolute", b.km && "khmer", b.table && "font-mono")} style={{
          left: b.x, top: b.y + yShift(b, page), width: b.w, height: b.h, fontSize: b.size, textAlign: b.align ?? "left", fontWeight: b.bold ? 700 : 400,
          lineHeight: b.km ? 1.7 : 1.45, letterSpacing: b.bold ? "0.06em" : undefined, transform: `rotate(${b.stamp ? b.tilt : b.tilt}deg)`, opacity: 0.88, whiteSpace: b.table ? "pre" : "normal", filter: "blur(.25px)",
          ...(b.stamp ? { border: "3px double #9b2c2c", color: "#9b2c2c", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999 } : {})
        }}>{b.truth}</div>
      ))}
      <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] tracking-widest" style={{ opacity: 0.55 }}>{source ?? "gazette_1996_03.pdf"} · {page + 1} / {total}</div>
    </div>
  );
}

/* ---------- Grapheme diff ---------- */
export type DiffOp = { t: "eq" | "add" | "del"; s: string };
function graphemes(s: string): string[] {
  try { const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: object) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter; if (Seg) return [...new Seg("km", { granularity: "grapheme" }).segment(s)].map((x) => x.segment); } catch { /* fall through */ }
  return Array.from(s);
}
export function diff(a: string, b: string): DiffOp[] {
  const x = graphemes(a), y = graphemes(b);
  const dp: number[][] = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffOp[] = []; const push = (t: DiffOp["t"], s: string) => { const l = out[out.length - 1]; if (l && l.t === t) l.s += s; else out.push({ t, s }); };
  let i = 0, j = 0;
  while (i < x.length && j < y.length) { if (x[i] === y[j]) { push("eq", x[i]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", x[i++]); else push("add", y[j++]); }
  while (i < x.length) push("del", x[i++]);
  while (j < y.length) push("add", y[j++]);
  return out;
}
