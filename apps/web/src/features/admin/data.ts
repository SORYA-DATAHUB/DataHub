import { datasets, RATES, users, type Dataset } from "@/mock/data";

export const TODAY = "2026-10-26";
export const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const gb = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} GB`;
export const fmtDate = (d: string) => new Date(d + (d.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export const rateFor = (kind: "raw" | "labeled") => RATES[kind];
export const userById = (id: string) => users.find((u) => u.id === id);
export const ageDays = (d: string) => Math.max(0, Math.round((Date.parse(TODAY) - Date.parse(d)) / 86400000));

export const REVIEWERS = ["Vireak Ly", "Anna Keller", "Bunthoeun Kim"] as const;

/* ---------- files ---------- */
export type FileStatus = "clean" | "duplicate" | "low_quality" | "scan_flagged";
export type MockFile = { id: string; name: string; type: string; sizeGb: number; pages: number; status: FileStatus; note?: string };
const EXT: Record<string, string[]> = {
  "PDF documents": ["pdf"], "Word documents": ["docx"], "Scanned documents": ["tif", "pdf"], "Handwritten documents": ["jpg"],
  "Historical documents": ["pdf", "tif"], Images: ["jpg", "png"], "Text files": ["txt"], "CSV / JSON datasets": ["csv", "json"]
};
export function filesFor(d: Dataset): MockFile[] {
  const n = 12;
  const exts = EXT[d.category] ?? ["pdf"];
  const seed = [...d.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const weights = Array.from({ length: n }, (_, i) => 0.6 + ((seed * (i + 3)) % 9) / 10);
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w, i) => {
    const ext = exts[i % exts.length];
    const status: FileStatus = i === 4 ? "duplicate" : i === 8 ? "low_quality" : i === 10 && seed % 3 === 0 ? "scan_flagged" : "clean";
    return {
      id: `${d.id}-F${String(i + 1).padStart(2, "0")}`, name: `${d.title.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}_${String(i + 1).padStart(4, "0")}.${ext}`,
      type: ext.toUpperCase(), sizeGb: Math.round((d.sizeGb * w / total) * 100) / 100, pages: 3 + ((seed + i * 7) % 18), status,
      note: status === "duplicate" ? "98% match with DS-10482 file 0112" : status === "low_quality" ? "Resolution below 150 DPI" : status === "scan_flagged" ? "Malware scanner flagged macro content" : undefined
    };
  });
}

/* ---------- reviews ---------- */
export type ReviewStatus = "submitted" | "in_review" | "completed";
export type Review = { id: string; datasetId: string; status: ReviewStatus; claimedBy: string | null; submitted: string; outcome?: string };
export const reviews: Review[] = [
  { id: "RV-2001", datasetId: "DS-10533", status: "submitted", claimedBy: null, submitted: "2026-10-04" },
  { id: "RV-2002", datasetId: "DS-10570", status: "in_review", claimedBy: "Vireak Ly", submitted: "2026-10-19" },
  { id: "RV-2003", datasetId: "DS-10574", status: "submitted", claimedBy: null, submitted: "2026-10-22" },
  { id: "RV-2004", datasetId: "DS-10517", status: "completed", claimedBy: "Anna Keller", submitted: "2026-09-11", outcome: "Partially approved" },
  { id: "RV-2005", datasetId: "DS-10482", status: "completed", claimedBy: "Vireak Ly", submitted: "2026-09-02", outcome: "Approved" },
  { id: "RV-2006", datasetId: "DS-10401", status: "completed", claimedBy: "Anna Keller", submitted: "2026-08-14", outcome: "Rejected" }
];
export const reviewById = (id: string) => reviews.find((r) => r.id === id);

/* ---------- verifications ---------- */
export type Verification = { id: string; userId: string; docType: string; country: string; submitted: string; status: "pending" | "approved" | "rejected"; history: Array<{ at: string; text: string }> };
export const verificationsSeed: Verification[] = [
  { id: "VER-901", userId: "u-3", docType: "National ID card", country: "Thailand", submitted: "2026-10-23", status: "pending", history: [{ at: "2026-10-23", text: "Submitted ID document and selfie" }, { at: "2026-09-27", text: "Account created" }] },
  { id: "VER-902", userId: "u-6", docType: "Passport", country: "Vietnam", submitted: "2026-10-20", status: "pending", history: [{ at: "2026-10-20", text: "Re-submitted passport scan" }, { at: "2026-09-02", text: "Rejected: image too blurry" }] },
  { id: "VER-903", userId: "u-5", docType: "National ID card", country: "Cambodia", submitted: "2026-10-25", status: "pending", history: [{ at: "2026-10-25", text: "Submitted ID document and selfie" }] },
  { id: "VER-880", userId: "u-1", docType: "National ID card", country: "Cambodia", submitted: "2026-03-13", status: "approved", history: [{ at: "2026-03-14", text: "Approved by Anna Keller" }, { at: "2026-03-13", text: "Submitted ID document" }] },
  { id: "VER-884", userId: "u-2", docType: "Passport", country: "Cambodia", submitted: "2026-02-04", status: "approved", history: [{ at: "2026-02-05", text: "Approved by Anna Keller" }] },
  { id: "VER-895", userId: "u-6", docType: "Driver licence", country: "Vietnam", submitted: "2026-09-01", status: "rejected", history: [{ at: "2026-09-02", text: "Rejected: image too blurry" }] }
];

/* ---------- activity ---------- */
export const adminActivity = [
  { id: "a1", actor: "Anna Keller", text: "approved verification VER-880", time: "12 min ago", href: "/admin/verifications" },
  { id: "a2", actor: "Vireak Ly", text: "claimed review RV-2002 (DS-10570)", time: "1 h ago", href: "/review/datasets/RV-2002" },
  { id: "a3", actor: "Anna Keller", text: "approved payout PO-3012 ($150.00)", time: "3 h ago", href: "/admin/payouts" },
  { id: "a4", actor: "Bunthoeun Kim", text: "updated upload size limit to 50 GB", time: "Yesterday", href: "/admin/settings" },
  { id: "a5", actor: "Anna Keller", text: "suspended account Rithy Heng", time: "2 days ago", href: "/admin/users/u-6" },
  { id: "a6", actor: "Vireak Ly", text: "partially approved DS-10517 (17.1 GB)", time: "3 days ago", href: "/admin/datasets/DS-10517" }
];

/* ---------- conversations ---------- */
export type Msg = { id: string; from: "user" | "admin"; author: string; text: string; time: string; attachment?: string };
export type Conversation = { id: string; userId: string; subject: string; datasetId?: string; status: "open" | "closed"; assignee: string | null; unread: boolean; updated: string; messages: Msg[] };
export const conversationsSeed: Conversation[] = [
  { id: "c-1", userId: "u-1", subject: "Question about DS-10540 feedback", datasetId: "DS-10540", status: "open", assignee: null, unread: true, updated: "2026-10-26 08:40", messages: [
    { id: "m1", from: "user", author: "Sokha Chan", text: "The reviewer asked for higher resolution scans. Do you accept 300 DPI TIFF?", time: "Oct 26, 08:40" }] },
  { id: "c-2", userId: "u-2", subject: "Payout PO-3021 timing", status: "open", assignee: "Anna Keller", unread: true, updated: "2026-10-25 16:12", messages: [
    { id: "m1", from: "user", author: "Dara Vong", text: "How long does manual approval take for a bank transfer?", time: "Oct 25, 15:50" },
    { id: "m2", from: "admin", author: "Anna Keller", text: "Payouts are approved manually, normally within 2 business days.", time: "Oct 25, 16:05" },
    { id: "m3", from: "user", author: "Dara Vong", text: "Thanks. Please see my ABA statement.", time: "Oct 25, 16:12", attachment: "aba-statement.pdf" }] },
  { id: "c-3", userId: "u-3", subject: "ID verification pending", status: "open", assignee: null, unread: false, updated: "2026-10-24 10:05", messages: [
    { id: "m1", from: "user", author: "Maly Sok", text: "My verification is still pending after 3 days.", time: "Oct 24, 10:05" }] },
  { id: "c-4", userId: "u-4", subject: "Duplicate flag on DS-10574", datasetId: "DS-10574", status: "closed", assignee: "Bunthoeun Kim", unread: false, updated: "2026-10-22 12:30", messages: [
    { id: "m1", from: "user", author: "Vireak Ly", text: "Why was one file flagged as duplicate?", time: "Oct 22, 11:00" },
    { id: "m2", from: "admin", author: "Bunthoeun Kim", text: "It matched an earlier archive at 98%. Duplicate data is not eligible for payment.", time: "Oct 22, 12:30" }] },
  { id: "c-5", userId: "u-5", subject: "Annotation reward question", status: "open", assignee: "Anna Keller", unread: false, updated: "2026-10-21 09:15", messages: [
    { id: "m1", from: "user", author: "Nita Pich", text: "When are annotation rewards added to my balance?", time: "Oct 21, 09:15" }] }
];

/* ---------- exports ---------- */
export type ExportJob = { id: string; name: string; datasets: string[]; format: string; include: string[]; status: "queued" | "processing" | "ready" | "failed"; progress: number; sizeGb: number; created: string; createdBy: string };
export const exportsSeed: ExportJob[] = [
  { id: "EXP-501", name: "Khmer gazette training set", datasets: ["DS-10482"], format: "ZIP", include: ["Originals", "Metadata", "Annotations"], status: "ready", progress: 100, sizeGb: 14.2, created: "2026-10-20", createdBy: "Anna Keller" },
  { id: "EXP-502", name: "Radio transcripts text corpus", datasets: ["DS-10566"], format: "JSONL", include: ["Originals", "Metadata"], status: "ready", progress: 100, sizeGb: 2.4, created: "2026-10-12", createdBy: "Bunthoeun Kim" },
  { id: "EXP-503", name: "Land titles (partial)", datasets: ["DS-10517"], format: "ZIP", include: ["Originals"], status: "failed", progress: 62, sizeGb: 17.1, created: "2026-10-05", createdBy: "Anna Keller" }
];

/* ---------- audit ---------- */
export type AuditEntry = { id: string; at: string; actor: string; action: string; entity: string; ip: string; result: "success" | "denied"; kind: "audit" | "security"; detail: string };
export const auditSeed: AuditEntry[] = [
  { id: "AL-9001", at: "2026-10-26 09:12", actor: "Anna Keller", action: "verification.approve", entity: "VER-880", ip: "203.0.113.24", result: "success", kind: "audit", detail: "status: pending -> approved" },
  { id: "AL-9002", at: "2026-10-26 08:31", actor: "Vireak Ly", action: "review.claim", entity: "RV-2002", ip: "203.0.113.58", result: "success", kind: "audit", detail: "claimedBy: null -> Vireak Ly" },
  { id: "AL-9003", at: "2026-10-25 17:44", actor: "Anna Keller", action: "payout.approve", entity: "PO-3012", ip: "203.0.113.24", result: "success", kind: "audit", detail: "amount: $150.00; status: requested -> approved" },
  { id: "AL-9004", at: "2026-10-25 14:02", actor: "Bunthoeun Kim", action: "settings.update", entity: "uploads.maxSizeGb", ip: "198.51.100.7", result: "success", kind: "audit", detail: "maxSizeGb: 40 -> 50" },
  { id: "AL-9005", at: "2026-10-24 11:20", actor: "Anna Keller", action: "user.suspend", entity: "u-6", ip: "203.0.113.24", result: "success", kind: "audit", detail: "status: active -> suspended; reason: policy violation" },
  { id: "AL-9006", at: "2026-10-24 10:03", actor: "Vireak Ly", action: "review.decision", entity: "RV-2004", ip: "203.0.113.58", result: "success", kind: "audit", detail: "outcome: partially_approved; acceptedGb: 17.1" },
  { id: "AL-9007", at: "2026-10-23 16:40", actor: "Anna Keller", action: "pricing.update", entity: "labeled", ip: "203.0.113.24", result: "denied", kind: "audit", detail: "Requires super_admin" },
  { id: "AL-9008", at: "2026-10-22 09:55", actor: "Anna Keller", action: "export.create", entity: "EXP-501", ip: "203.0.113.24", result: "success", kind: "audit", detail: "datasets: DS-10482; format: ZIP" },
  { id: "AL-9101", at: "2026-10-26 07:58", actor: "Bunthoeun Kim", action: "auth.login", entity: "session", ip: "198.51.100.7", result: "success", kind: "security", detail: "MFA verified (TOTP)" },
  { id: "AL-9102", at: "2026-10-25 22:13", actor: "unknown", action: "auth.login_failed", entity: "anna.keller@example.com", ip: "192.0.2.91", result: "denied", kind: "security", detail: "5 failed attempts, rate limit applied" },
  { id: "AL-9103", at: "2026-10-25 08:30", actor: "Anna Keller", action: "auth.mfa_challenge", entity: "session", ip: "203.0.113.24", result: "success", kind: "security", detail: "MFA verified (TOTP)" },
  { id: "AL-9104", at: "2026-10-24 19:02", actor: "Anna Keller", action: "session.revoke", entity: "u-6", ip: "203.0.113.24", result: "success", kind: "security", detail: "3 sessions revoked" },
  { id: "AL-9105", at: "2026-10-23 03:41", actor: "unknown", action: "auth.login_failed", entity: "admin@example.com", ip: "192.0.2.17", result: "denied", kind: "security", detail: "Unknown account" }
];

/* ---------- roles ---------- */
export const ROLES = ["Contributor", "Annotator", "Reviewer", "Administrator", "Super Administrator"] as const;
export const PERMISSIONS = ["Upload datasets", "Annotate tasks", "Review datasets", "Verify contributors", "Approve payouts", "Manage users", "Export datasets", "Change pricing", "Read audit logs", "Edit system settings"] as const;
export const ROLE_MATRIX: Record<string, string[]> = {
  Contributor: ["Upload datasets"],
  Annotator: ["Annotate tasks"],
  Reviewer: ["Review datasets"],
  Administrator: ["Review datasets", "Verify contributors", "Approve payouts", "Manage users", "Export datasets"],
  "Super Administrator": [...PERMISSIONS]
};

/* ---------- settings ---------- */
export const settingsDefaults = {
  general: { platformName: "DataHub", supportEmail: "support@datahub.example", maintenance: false, defaultLanguage: "English" },
  uploads: { maxSizeGb: 50, maxFiles: 10000, types: { PDF: true, DOCX: true, TXT: true, CSV: true, JSON: true, JPG: true, PNG: true, TIFF: true, ZIP: true } as Record<string, boolean>, virusScan: true, dedupe: true, retentionDays: 90 },
  finance: { minWithdrawal: 25, rateRaw: 1.0, rateLabeled: 1.5, manualApproval: true, payoutMethods: { "Bank transfer (ABA)": true, Wing: true, PayPal: false } as Record<string, boolean>, notifyOnPayout: true },
  annotation: { defaultReviewSample: 20, reviewerRequired: true, maxTasksPerAnnotator: 25, deadlineDays: 7, autoAssign: false },
  security: { mfaRequiredAdmins: true, sessionHours: 12, ipAllowlist: "", notifyNewDevice: true, reviewSla: 3 }
};
export type Settings = typeof settingsDefaults;

/* ---------- misc series ---------- */
export const growth = [
  { m: "May", datasets: 38, gb: 120 }, { m: "Jun", datasets: 52, gb: 188 }, { m: "Jul", datasets: 71, gb: 261 },
  { m: "Aug", datasets: 88, gb: 330 }, { m: "Sep", datasets: 117, gb: 452 }, { m: "Oct", datasets: 139, gb: 540 }
];
export const spending = [
  { m: "May", raw: 410, labeled: 120, annotation: 90 }, { m: "Jun", raw: 520, labeled: 210, annotation: 140 }, { m: "Jul", raw: 690, labeled: 280, annotation: 190 },
  { m: "Aug", raw: 640, labeled: 330, annotation: 260 }, { m: "Sep", raw: 880, labeled: 420, annotation: 310 }, { m: "Oct", raw: 950, labeled: 510, annotation: 380 }
];
export const reviewTime = [
  { m: "May", hours: 41 }, { m: "Jun", hours: 36 }, { m: "Jul", hours: 33 }, { m: "Aug", hours: 30 }, { m: "Sep", hours: 27 }, { m: "Oct", hours: 24 }
];
export const quality = [
  { m: "May", score: 71 }, { m: "Jun", score: 74 }, { m: "Jul", score: 77 }, { m: "Aug", score: 79 }, { m: "Sep", score: 82 }, { m: "Oct", score: 84 }
];
export const newContributors = [
  { m: "May", users: 22 }, { m: "Jun", users: 31 }, { m: "Jul", users: 40 }, { m: "Aug", users: 38 }, { m: "Sep", users: 55 }, { m: "Oct", users: 61 }
];
export const throughput = [
  { m: "May", tasks: 210 }, { m: "Jun", tasks: 340 }, { m: "Jul", tasks: 420 }, { m: "Aug", tasks: 510 }, { m: "Sep", tasks: 640 }, { m: "Oct", tasks: 720 }
];
export const MONTH_ORDER = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];

export const ownerDatasets = (userId: string) => datasets.filter((d) => d.ownerId === userId);
