/** Shared realistic mock data. All amounts follow the pricing rules: raw $1.00/accepted GB, labeled $1.50/accepted GB. */
export const RATES = { raw: 1.0, labeled: 1.5, minWithdrawal: 25 } as const;

export type DatasetStatus = "uploading" | "processing" | "pending_review" | "changes_requested" | "partially_approved" | "approved" | "rejected";
export type Dataset = {
  id: string; title: string; description: string; category: string; language: string; kind: "raw" | "labeled";
  status: DatasetStatus; uploaded: string; sizeGb: number; acceptedGb: number; files: number; qualityScore: number | null;
  ownerId: string; owner: string;
};
export const CATEGORIES = ["PDF documents", "Word documents", "Scanned documents", "Handwritten documents", "Historical documents", "Images", "Text files", "CSV / JSON datasets"] as const;

export const datasets: Dataset[] = [
  { id: "DS-10482", title: "Ministry gazette archive 1994–2003", description: "Scanned monthly gazettes with OCR sidecar text.", category: "Historical documents", language: "Khmer", kind: "labeled", status: "approved", uploaded: "2026-09-02", sizeGb: 14.8, acceptedGb: 14.2, files: 1284, qualityScore: 94, ownerId: "u-1", owner: "Sokha Chan" },
  { id: "DS-10517", title: "Provincial land title scans", description: "High-resolution scanned titles, personal data redacted.", category: "Scanned documents", language: "Khmer", kind: "raw", status: "partially_approved", uploaded: "2026-09-11", sizeGb: 22.4, acceptedGb: 17.1, files: 3102, qualityScore: 81, ownerId: "u-1", owner: "Sokha Chan" },
  { id: "DS-10533", title: "University thesis PDFs (English)", description: "Open-licence theses, text-based PDFs.", category: "PDF documents", language: "English", kind: "raw", status: "pending_review", uploaded: "2026-10-04", sizeGb: 9.6, acceptedGb: 0, files: 412, qualityScore: null, ownerId: "u-1", owner: "Sokha Chan" },
  { id: "DS-10540", title: "Handwritten school notebooks", description: "Notebook pages from 1970s schoolchildren.", category: "Handwritten documents", language: "Khmer", kind: "raw", status: "changes_requested", uploaded: "2026-10-08", sizeGb: 5.3, acceptedGb: 0, files: 880, qualityScore: 62, ownerId: "u-1", owner: "Sokha Chan" },
  { id: "DS-10551", title: "Market price tables 2020–2025", description: "Weekly price bulletins as CSV.", category: "CSV / JSON datasets", language: "English", kind: "labeled", status: "processing", uploaded: "2026-10-21", sizeGb: 1.2, acceptedGb: 0, files: 260, qualityScore: null, ownerId: "u-1", owner: "Sokha Chan" },
  { id: "DS-10560", title: "Temple inscription photographs", description: "Field photographs of stone inscriptions.", category: "Images", language: "Khmer", kind: "raw", status: "uploading", uploaded: "2026-10-25", sizeGb: 31.0, acceptedGb: 0, files: 5400, qualityScore: null, ownerId: "u-1", owner: "Sokha Chan" },
  { id: "DS-10401", title: "Stock newspaper clippings", description: "Duplicated commercial content.", category: "Scanned documents", language: "English", kind: "raw", status: "rejected", uploaded: "2026-08-14", sizeGb: 3.1, acceptedGb: 0, files: 190, qualityScore: 28, ownerId: "u-1", owner: "Sokha Chan" },
  { id: "DS-10566", title: "Radio transcripts 2011", description: "Plain-text transcripts of public radio.", category: "Text files", language: "Khmer", kind: "labeled", status: "approved", uploaded: "2026-07-30", sizeGb: 2.4, acceptedGb: 2.4, files: 1900, qualityScore: 97, ownerId: "u-2", owner: "Dara Vong" },
  { id: "DS-10570", title: "Legal code commentaries", description: "Word documents of legal commentary.", category: "Word documents", language: "Khmer", kind: "raw", status: "pending_review", uploaded: "2026-10-19", sizeGb: 4.7, acceptedGb: 0, files: 330, qualityScore: null, ownerId: "u-3", owner: "Maly Sok" },
  { id: "DS-10574", title: "Birth register scans Kampot", description: "Civil registry page scans.", category: "Scanned documents", language: "Khmer", kind: "raw", status: "pending_review", uploaded: "2026-10-22", sizeGb: 18.2, acceptedGb: 0, files: 2750, qualityScore: null, ownerId: "u-4", owner: "Vireak Ly" }
];
export const datasetById = (id: string) => datasets.find((d) => d.id === id);

export type User = { id: string; name: string; email: string; roles: string[]; verification: "verified" | "pending" | "unverified"; status: "active" | "suspended"; uploads: number; acceptedGb: number; earnings: number; joined: string; country: string };
export const users: User[] = [
  { id: "u-1", name: "Sokha Chan", email: "sokha.chan@example.com", roles: ["Contributor", "Annotator"], verification: "verified", status: "active", uploads: 7, acceptedGb: 33.7, earnings: 48.9, joined: "2026-03-12", country: "Cambodia" },
  { id: "u-2", name: "Dara Vong", email: "dara.vong@example.com", roles: ["Contributor"], verification: "verified", status: "active", uploads: 12, acceptedGb: 61.0, earnings: 91.5, joined: "2026-02-03", country: "Cambodia" },
  { id: "u-3", name: "Maly Sok", email: "maly.sok@example.com", roles: ["Contributor"], verification: "pending", status: "active", uploads: 2, acceptedGb: 0, earnings: 0, joined: "2026-09-27", country: "Thailand" },
  { id: "u-4", name: "Vireak Ly", email: "vireak.ly@example.com", roles: ["Contributor", "Reviewer"], verification: "verified", status: "active", uploads: 5, acceptedGb: 19.4, earnings: 29.1, joined: "2026-04-18", country: "Cambodia" },
  { id: "u-5", name: "Nita Pich", email: "nita.pich@example.com", roles: ["Annotator"], verification: "verified", status: "active", uploads: 0, acceptedGb: 0, earnings: 212.4, joined: "2026-05-02", country: "Cambodia" },
  { id: "u-6", name: "Rithy Heng", email: "rithy.heng@example.com", roles: ["Contributor"], verification: "unverified", status: "suspended", uploads: 3, acceptedGb: 0, earnings: 0, joined: "2026-08-09", country: "Vietnam" },
  { id: "u-7", name: "Anna Keller", email: "anna.keller@example.com", roles: ["Administrator"], verification: "verified", status: "active", uploads: 0, acceptedGb: 0, earnings: 0, joined: "2025-12-01", country: "Germany" },
  { id: "u-8", name: "Bunthoeun Kim", email: "b.kim@example.com", roles: ["Super Administrator"], verification: "verified", status: "active", uploads: 0, acceptedGb: 0, earnings: 0, joined: "2025-11-11", country: "Cambodia" }
];

export type Payout = { id: string; userId: string; user: string; amount: number; method: string; requested: string; status: "requested" | "under_review" | "approved" | "processing" | "paid" | "rejected" | "failed"; reference?: string };
export const payouts: Payout[] = [
  { id: "PO-3021", userId: "u-2", user: "Dara Vong", amount: 91.5, method: "Bank transfer (ABA)", requested: "2026-10-24", status: "requested" },
  { id: "PO-3018", userId: "u-1", user: "Sokha Chan", amount: 40.0, method: "Wing", requested: "2026-10-20", status: "under_review" },
  { id: "PO-3012", userId: "u-5", user: "Nita Pich", amount: 150.0, method: "Bank transfer (ABA)", requested: "2026-10-14", status: "approved" },
  { id: "PO-3005", userId: "u-4", user: "Vireak Ly", amount: 29.1, method: "Wing", requested: "2026-10-09", status: "paid", reference: "WNG-88213" },
  { id: "PO-2990", userId: "u-1", user: "Sokha Chan", amount: 22.5, method: "Wing", requested: "2026-09-18", status: "paid", reference: "WNG-77410" },
  { id: "PO-2984", userId: "u-3", user: "Maly Sok", amount: 30.0, method: "PayPal", requested: "2026-09-12", status: "rejected" },
  { id: "PO-2971", userId: "u-2", user: "Dara Vong", amount: 60.0, method: "Bank transfer (ABA)", requested: "2026-09-02", status: "failed" }
];

export type Task = { id: string; project: string; file: string; page: number; assignee: string | null; status: "assigned" | "in_progress" | "submitted" | "corrections_requested" | "approved"; deadline: string; completion: number; quality: number | null; reward: number };
export const tasks: Task[] = [
  { id: "T-5501", project: "Gazette OCR correction", file: "gazette_1996_03.pdf", page: 4, assignee: "Sokha Chan", status: "in_progress", deadline: "2026-11-02", completion: 45, quality: null, reward: 0.4 },
  { id: "T-5502", project: "Gazette OCR correction", file: "gazette_1996_03.pdf", page: 5, assignee: "Sokha Chan", status: "assigned", deadline: "2026-11-02", completion: 0, quality: null, reward: 0.4 },
  { id: "T-5498", project: "Gazette OCR correction", file: "gazette_1995_12.pdf", page: 11, assignee: "Nita Pich", status: "submitted", deadline: "2026-10-30", completion: 100, quality: null, reward: 0.4 },
  { id: "T-5490", project: "Notebook transcription", file: "notebook_017.jpg", page: 1, assignee: "Nita Pich", status: "corrections_requested", deadline: "2026-10-28", completion: 90, quality: 72, reward: 0.6 },
  { id: "T-5477", project: "Notebook transcription", file: "notebook_011.jpg", page: 1, assignee: "Sokha Chan", status: "approved", deadline: "2026-10-20", completion: 100, quality: 96, reward: 0.6 },
  { id: "T-5510", project: "Land title classification", file: "title_8841.tif", page: 1, assignee: null, status: "assigned", deadline: "2026-11-10", completion: 0, quality: null, reward: 0.25 }
];

export const notifications = [
  { id: "n1", type: "dataset_approved", title: "Dataset approved", body: "DS-10482 was approved: 14.2 GB accepted, $21.30 credited.", time: "2h ago", read: false },
  { id: "n2", type: "changes_requested", title: "Changes requested", body: "Reviewer asked for higher resolution scans on DS-10540.", time: "5h ago", read: false },
  { id: "n3", type: "message", title: "New message from Support", body: "We need one more detail about your payout method.", time: "Yesterday", read: false },
  { id: "n4", type: "payment", title: "Payment completed", body: "PO-3005 was paid. Reference WNG-88213.", time: "2 days ago", read: true },
  { id: "n5", type: "upload", title: "Upload completed", body: "DS-10551 finished uploading and is processing.", time: "4 days ago", read: true },
  { id: "n6", type: "task", title: "Task assigned", body: "T-5502 was assigned to you. Due Nov 2.", time: "5 days ago", read: true }
];

export const monthly = [
  { m: "May", uploaded: 18, accepted: 11, earnings: 14 }, { m: "Jun", uploaded: 26, accepted: 19, earnings: 28 }, { m: "Jul", uploaded: 31, accepted: 24, earnings: 36 },
  { m: "Aug", uploaded: 29, accepted: 20, earnings: 31 }, { m: "Sep", uploaded: 44, accepted: 36, earnings: 54 }, { m: "Oct", uploaded: 52, accepted: 31, earnings: 47 }
];

export const KHMER_SAMPLE = "ព្រះរាជាណាចក្រកម្ពុជា ជាតិ សាសនា ព្រះមហាក្សត្រ។ ក្រសួងយុត្តិធម៌ ប្រកាសលេខ ០៣៤ ស្តីពីការរៀបចំបញ្ជីអត្រានុកូលដ្ឋាន។";
export const ACCEPTED_FORMATS = ["PDF", "DOCX", "TXT", "CSV", "JSON", "JPG", "PNG", "TIFF", "ZIP"] as const;
