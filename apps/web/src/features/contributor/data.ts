import { datasets as baseDatasets, RATES, type Dataset, type DatasetStatus } from "@/mock/data";

/** Demo "today". Fixed so server and client render the same text. */
export const TODAY = "2026-10-26";
export const ME = { id: "u-1", name: "Sokha Chan", email: "sokha.chan@example.com" };

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";
export const fmtMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(mb < 10 ? 1 : 0)} MB`);
export const fmtBytes = (b: number) => fmtMb(b / 1048576);

/* ---------------- Datasets ---------------- */
export type CDataset = Dataset & { source?: string; dataType?: string; draft?: boolean };
export const STATUSES: DatasetStatus[] = ["uploading", "processing", "pending_review", "changes_requested", "partially_approved", "approved", "rejected"];
export const STATUS_LABEL: Record<DatasetStatus, string> = {
  uploading: "Uploading", processing: "Processing", pending_review: "Pending review", changes_requested: "Changes requested",
  partially_approved: "Partially approved", approved: "Approved", rejected: "Rejected"
};
export const myBase: CDataset[] = baseDatasets.filter((d) => d.ownerId === ME.id);
export const rate = (k: "raw" | "labeled") => RATES[k];
/** Earnings the dataset has already been credited. */
export const approvedEarnings = (d: Dataset) => d.acceptedGb * rate(d.kind);
/** Estimated earnings still waiting on review (never real money until approved). */
export const estimatedEarnings = (d: Dataset) => {
  if (d.status === "rejected" || d.status === "approved" || d.status === "partially_approved") return 0;
  return d.sizeGb * rate(d.kind);
};
export const rejectedGb = (d: Dataset) => (d.status === "rejected" ? d.sizeGb : d.status === "approved" || d.status === "partially_approved" ? Math.max(0, d.sizeGb - d.acceptedGb) : 0);
export const pendingGb = (d: Dataset) => (["uploading", "processing", "pending_review", "changes_requested"].includes(d.status) ? d.sizeGb : 0);
export const canResubmit = (s: DatasetStatus) => s === "changes_requested" || s === "partially_approved";

export const LANGUAGES = ["Khmer", "English", "Khmer + English", "French", "Thai", "Vietnamese", "Other"];
export const DATA_TYPES = ["Documents (text-based)", "Scanned pages", "Photographs", "Structured tables", "Mixed"];
export const CATEGORY_HINTS: Record<string, string> = {
  "PDF documents": "Text-based or scanned PDFs", "Word documents": "DOC / DOCX files", "Scanned documents": "TIFF / JPG / PNG page scans",
  "Handwritten documents": "Notes, letters, registers", "Historical documents": "Archives, gazettes, manuscripts", Images: "Photographs and figures",
  "Text files": "Plain text, transcripts", "CSV / JSON datasets": "Structured tabular data"
};
const EXT: Record<string, string> = {
  "PDF documents": "pdf", "Word documents": "docx", "Scanned documents": "tif", "Handwritten documents": "jpg", "Historical documents": "pdf",
  Images: "jpg", "Text files": "txt", "CSV / JSON datasets": "csv"
};

/* ---------------- Dataset files (deterministic mock) ---------------- */
export type FileStatus = "accepted" | "rejected" | "pending" | "processing" | "uploading";
export type DFile = { id: string; name: string; sizeMb: number; status: FileStatus; reason?: string; ext: string };
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h = h >>> 0 || 1;
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return (h % 10000) / 10000; };
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 22);
const FIX_REASONS = ["Resolution below 150 DPI", "Page is cropped or cut off", "Scan is skewed more than 5 degrees", "Unreadable or corrupt file"];
const REJ_REASONS = ["Duplicate of an existing dataset file", "Contains unredacted personal data", "Unreadable or corrupt file", "Out of scope for this category"];
export function generateFiles(d: Dataset): DFile[] {
  const r = rng(d.id);
  const n = Math.min(d.files, 30);
  const ext = EXT[d.category] ?? "pdf";
  const avg = (d.sizeGb * 1024) / Math.max(1, d.files);
  return Array.from({ length: n }, (_, i) => {
    const roll = r();
    let status: FileStatus = "pending"; let reason: string | undefined;
    switch (d.status) {
      case "approved": status = roll < 0.06 ? "rejected" : "accepted"; if (status === "rejected") reason = REJ_REASONS[0]; break;
      case "partially_approved": status = roll < 0.26 ? "rejected" : "accepted"; if (status === "rejected") reason = FIX_REASONS[Math.floor(r() * FIX_REASONS.length)]; break;
      case "changes_requested": status = roll < 0.34 ? "rejected" : "pending"; if (status === "rejected") reason = FIX_REASONS[Math.floor(r() * FIX_REASONS.length)]; break;
      case "rejected": status = "rejected"; reason = REJ_REASONS[Math.floor(r() * REJ_REASONS.length)]; break;
      case "processing": status = i < n * 0.6 ? "processing" : "pending"; break;
      case "uploading": status = i < n * 0.4 ? "pending" : "uploading"; break;
      default: status = "pending";
    }
    return { id: `f${String(i + 1).padStart(3, "0")}`, name: `${slug(d.title)}_${String(i + 1).padStart(4, "0")}.${ext}`, sizeMb: Math.round(avg * (0.6 + r() * 0.8) * 10) / 10, status, reason, ext };
  });
}

export type TimelineEvent = { at: string; title: string; detail?: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" };
const addDays = (iso: string, n: number) => new Date(new Date(iso).getTime() + n * 86400000).toISOString().slice(0, 10);
export function timeline(d: Dataset): TimelineEvent[] {
  const ev: TimelineEvent[] = [{ at: d.uploaded, title: "Upload started", detail: `${d.files.toLocaleString()} files selected`, tone: "neutral" }];
  if (d.status === "uploading") return ev;
  ev.push({ at: d.uploaded, title: "Upload completed", detail: "All files received and checksummed", tone: "brand" });
  if (d.status === "processing") return ev;
  ev.push({ at: addDays(d.uploaded, 1), title: "Automatic checks passed", detail: "Format, duplicate and size checks finished", tone: "brand" });
  ev.push({ at: addDays(d.uploaded, 1), title: "Submitted for review", tone: "warning" });
  if (d.status === "pending_review") return ev;
  if (d.status === "changes_requested") ev.push({ at: addDays(d.uploaded, 4), title: "Changes requested", detail: "Reviewer asked for fixes to rejected files", tone: "warning" });
  if (d.status === "partially_approved") ev.push({ at: addDays(d.uploaded, 5), title: "Partially approved", detail: `${d.acceptedGb} GB accepted, remaining files can be fixed and resubmitted`, tone: "brand" }, { at: addDays(d.uploaded, 5), title: "Earnings credited", detail: `$${approvedEarnings(d).toFixed(2)} added to your balance`, tone: "success" });
  if (d.status === "approved") ev.push({ at: addDays(d.uploaded, 6), title: "Approved", detail: `${d.acceptedGb} GB accepted`, tone: "success" }, { at: addDays(d.uploaded, 6), title: "Earnings credited", detail: `$${approvedEarnings(d).toFixed(2)} added to your balance`, tone: "success" });
  if (d.status === "rejected") ev.push({ at: addDays(d.uploaded, 3), title: "Rejected", detail: "No files met the acceptance rules", tone: "danger" });
  return ev;
}

export type Feedback = { id: string; author: string; role: string; at: string; kind: "note" | "changes" | "approved" | "rejected"; body: string; items?: string[] };
export function feedbackFor(d: Dataset): Feedback[] {
  const at = addDays(d.uploaded, 4);
  switch (d.status) {
    case "changes_requested": return [{ id: "fb1", author: "Vireak Ly", role: "Reviewer", at, kind: "changes", body: "Several pages are below our minimum quality. Please rescan or replace them, then resubmit.", items: FIX_REASONS.slice(0, 3) }];
    case "partially_approved": return [{ id: "fb1", author: "Vireak Ly", role: "Reviewer", at, kind: "approved", body: `${d.acceptedGb} GB accepted. The remaining files did not pass quality checks.`, items: FIX_REASONS.slice(0, 2) }];
    case "approved": return [{ id: "fb1", author: "Vireak Ly", role: "Reviewer", at, kind: "approved", body: "Great quality and clear provenance. Approved for the marketplace." }];
    case "rejected": return [{ id: "fb1", author: "Anna Keller", role: "Administrator", at, kind: "rejected", body: "This dataset duplicates commercial content we cannot license. You may upload different material.", items: REJ_REASONS.slice(0, 2) }];
    default: return [];
  }
}

/* ---------------- Wallet / withdrawals ---------------- */
export type WStatus = "requested" | "under_review" | "approved" | "processing" | "paid" | "rejected" | "failed";
export type Withdrawal = { id: string; amount: number; method: string; requested: string; status: WStatus; reference?: string; note?: string };
export const W_LABEL: Record<WStatus, string> = { requested: "Requested", under_review: "Under review", approved: "Approved", processing: "Processing", paid: "Paid", rejected: "Rejected", failed: "Failed" };
export const withdrawalSeeds: Withdrawal[] = [
  { id: "PO-3018", amount: 40, method: "Wing ••• 4821", requested: "2026-10-20", status: "under_review" },
  { id: "PO-3011", amount: 25, method: "ABA Bank ••• 7712", requested: "2026-10-17", status: "approved" },
  { id: "PO-3003", amount: 30, method: "Wing ••• 4821", requested: "2026-10-12", status: "processing" },
  { id: "PO-2988", amount: 35, method: "ABA Bank ••• 7712", requested: "2026-09-30", status: "paid", reference: "ABA-440912" },
  { id: "PO-2950", amount: 30, method: "Wing ••• 4821", requested: "2026-09-08", status: "paid", reference: "WNG-77410" },
  { id: "PO-2941", amount: 25, method: "PayPal ••• sokha@", requested: "2026-08-29", status: "rejected", note: "Payout method name did not match verified identity." },
  { id: "PO-2933", amount: 50, method: "ABA Bank ••• 7712", requested: "2026-08-21", status: "failed", note: "Bank declined the transfer (account closed). Funds returned to your balance." }
];
export const LIFETIME_APPROVED = 241.4;
export const RESERVED_STATUSES: WStatus[] = ["requested", "under_review", "approved", "processing"];
export function wallet(ws: Withdrawal[], ds: Dataset[]) {
  const paid = ws.filter((w) => w.status === "paid").reduce((a, w) => a + w.amount, 0);
  const reserved = ws.filter((w) => RESERVED_STATUSES.includes(w.status)).reduce((a, w) => a + w.amount, 0);
  const pending = ds.reduce((a, d) => a + estimatedEarnings(d), 0);
  return { approved: LIFETIME_APPROVED, paid, reserved, pending, available: Math.max(0, Math.round((LIFETIME_APPROVED - paid - reserved) * 100) / 100) };
}
export function withdrawalEvents(w: Withdrawal): TimelineEvent[] {
  const ev: TimelineEvent[] = [{ at: w.requested, title: "Withdrawal requested", detail: `$${w.amount.toFixed(2)} reserved from your available balance`, tone: "neutral" }];
  const order: WStatus[] = ["requested", "under_review", "approved", "processing", "paid"];
  const idx = order.indexOf(w.status);
  const upto = (s: WStatus) => idx >= order.indexOf(s);
  if (w.status === "rejected") ev.push({ at: addDays(w.requested, 1), title: "Under review", tone: "warning" }, { at: addDays(w.requested, 2), title: "Rejected", detail: w.note, tone: "danger" });
  else if (w.status === "failed") ev.push({ at: addDays(w.requested, 1), title: "Approved by finance", tone: "success" }, { at: addDays(w.requested, 2), title: "Payment failed", detail: w.note, tone: "danger" });
  else {
    if (upto("under_review")) ev.push({ at: addDays(w.requested, 1), title: "Under review", detail: "Finance is checking eligibility and payout method", tone: "warning" });
    if (upto("approved")) ev.push({ at: addDays(w.requested, 2), title: "Approved", detail: "Manually approved by a finance administrator", tone: "success" });
    if (upto("processing")) ev.push({ at: addDays(w.requested, 3), title: "Payment processing", tone: "brand" });
    if (upto("paid")) ev.push({ at: addDays(w.requested, 4), title: "Paid", detail: `Reference ${w.reference}`, tone: "success" });
  }
  return ev;
}

export type Tx = { id: string; date: string; type: "credit" | "payout" | "reserved"; description: string; ref?: string; amount: number };
export const creditSeeds: Tx[] = [
  { id: "TX-9021", date: "2026-09-12", type: "credit", description: "Ministry gazette archive 1994-2003 (14.2 GB labeled x $1.50)", ref: "DS-10482", amount: 21.3 },
  { id: "TX-9020", date: "2026-09-16", type: "credit", description: "Provincial land title scans (17.1 GB raw x $1.00)", ref: "DS-10517", amount: 17.1 },
  { id: "TX-8911", date: "2026-08-20", type: "credit", description: "Parliament session records (41.3 GB x $1.50)", ref: "DS-10201", amount: 62 },
  { id: "TX-8802", date: "2026-07-25", type: "credit", description: "Provincial radio archive (48.5 GB x $1.00)", ref: "DS-10244", amount: 48.5 },
  { id: "TX-8744", date: "2026-07-02", type: "credit", description: "Schoolbook scans (39.2 GB x $1.00)", ref: "DS-10290", amount: 39.2 },
  { id: "TX-8690", date: "2026-06-14", type: "credit", description: "Village survey forms (29.8 GB x $1.00)", ref: "DS-10333", amount: 29.8 },
  { id: "TX-8611", date: "2026-05-22", type: "credit", description: "Folk song transcripts (15.7 GB x $1.50)", ref: "DS-10377", amount: 23.5 }
];
export const monthlyEarnings = [{ m: "May", earnings: 23.5 }, { m: "Jun", earnings: 29.8 }, { m: "Jul", earnings: 87.7 }, { m: "Aug", earnings: 62 }, { m: "Sep", earnings: 38.4 }, { m: "Oct", earnings: 0 }];
export const earningsByCategory = [{ name: "Historical documents", value: 83.8 }, { name: "Scanned documents", value: 66.3 }, { name: "Handwritten documents", value: 39.2 }, { name: "Text files", value: 52.1 }];

/* ---------------- Notifications ---------------- */
export type NType = "upload_completed" | "dataset_approved" | "dataset_rejected" | "changes_requested" | "earnings_credited" | "withdrawal_approved" | "payment_completed" | "new_message" | "task_assigned";
export type Notif = { id: string; type: NType; title: string; body: string; time: string; read: boolean; href: string };
export const N_LABEL: Record<NType, string> = {
  upload_completed: "Upload completed", dataset_approved: "Approved", dataset_rejected: "Rejected", changes_requested: "Changes requested",
  earnings_credited: "Earnings", withdrawal_approved: "Withdrawal", payment_completed: "Payment", new_message: "Message", task_assigned: "Task"
};
export const notifSeeds: Notif[] = [
  { id: "n1", type: "dataset_approved", title: "Dataset approved", body: "DS-10482 was approved: 14.2 GB accepted.", time: "2h ago", read: false, href: "/datasets/DS-10482" },
  { id: "n2", type: "earnings_credited", title: "Earnings credited", body: "$21.30 was added to your available balance for DS-10482.", time: "2h ago", read: false, href: "/earnings?tab=transactions" },
  { id: "n3", type: "changes_requested", title: "Changes requested", body: "Reviewer asked for higher resolution scans on DS-10540.", time: "5h ago", read: false, href: "/datasets/DS-10540?tab=feedback" },
  { id: "n4", type: "new_message", title: "New message from Support", body: "We need one more detail about your payout method.", time: "Yesterday", read: false, href: "/messages/c-1" },
  { id: "n5", type: "withdrawal_approved", title: "Withdrawal approved", body: "PO-3011 for $25.00 was approved and will be paid soon.", time: "Yesterday", read: true, href: "/withdrawals/PO-3011" },
  { id: "n6", type: "payment_completed", title: "Payment completed", body: "PO-2988 was paid. Reference ABA-440912.", time: "2 days ago", read: true, href: "/withdrawals/PO-2988" },
  { id: "n7", type: "upload_completed", title: "Upload completed", body: "DS-10551 finished uploading and is processing.", time: "4 days ago", read: true, href: "/datasets/DS-10551" },
  { id: "n8", type: "task_assigned", title: "Task assigned", body: "T-5502 was assigned to you. Due Nov 2.", time: "5 days ago", read: true, href: "/annotate/tasks" },
  { id: "n9", type: "dataset_rejected", title: "Dataset rejected", body: "DS-10401 did not meet acceptance rules.", time: "2 months ago", read: true, href: "/datasets/DS-10401?tab=feedback" }
];

/* ---------------- Payout methods ---------------- */
export type PayoutMethod = { id: string; type: "Wing" | "ABA Bank" | "PayPal"; label: string; account: string; isDefault: boolean };
export const methodSeeds: PayoutMethod[] = [
  { id: "pm-1", type: "Wing", label: "Wing personal", account: "012 345 4821", isDefault: true },
  { id: "pm-2", type: "ABA Bank", label: "ABA savings", account: "000 123 7712", isDefault: false }
];
export const maskAccount = (a: string) => `••• ${a.replace(/\s/g, "").slice(-4)}`;
export type Verification = "unverified" | "pending" | "verified";

/** Used by the uploader's duplicate detection (simulated catalog of already-known files). */
export const KNOWN_FILES = ["gazette_1996_03.pdf", "ministry_gazette_1996_03.pdf"];
