import { tasks as baseTasks } from "@/mock/data";

export const ME = "Sokha Chan";
export const REVIEWER = "Vireak Ly";

export type TaskStatus = "unassigned" | "assigned" | "in_progress" | "submitted" | "in_review" | "corrections_requested" | "approved";
export type AnnType = "Transcription" | "Text correction" | "Page classification" | "Metadata tagging";
export type ProjectStatus = "draft" | "active" | "paused" | "closed";
export type Feedback = { id: string; author: string; at: string; text: string; region?: number; resolved?: boolean };
export type AnnTask = {
  id: string; projectId: string; file: string; page: number; pages: number; assignee: string | null; status: TaskStatus;
  deadline: string; completion: number; quality: number | null; reward: number; updated: string; attempts: number;
  feedback: Feedback[]; reviewer?: string;
};
export type Project = {
  id: string; name: string; datasetId: string; dataset: string; type: AnnType; status: ProjectStatus; deadline: string; reward: number;
  unit: "page" | "file" | "batch"; instructions: string; annotators: string[]; labels: string[]; created: string; quality: number;
};
export type Annotator = { name: string; accuracy: number; done: number; capacity: number; perDay: number; rate: number };

export const ANNOTATORS: Annotator[] = [
  { name: "Sokha Chan", accuracy: 94, done: 112, capacity: 12, perDay: 14, rate: 0.5 },
  { name: "Nita Pich", accuracy: 91, done: 168, capacity: 15, perDay: 19, rate: 0.5 },
  { name: "Dara Vong", accuracy: 88, done: 74, capacity: 10, perDay: 11, rate: 0.45 },
  { name: "Maly Sok", accuracy: 86, done: 41, capacity: 8, perDay: 8, rate: 0.45 },
  { name: "Chenda Roth", accuracy: 95, done: 203, capacity: 15, perDay: 22, rate: 0.55 },
  { name: "Piseth Mao", accuracy: 79, done: 29, capacity: 6, perDay: 5, rate: 0.4 }
];

export const DEFAULT_INSTRUCTIONS = `1. Transcribe every text region exactly as printed. Do not normalise spelling.
2. Keep Khmer and English text in reading order; preserve punctuation and numerals (e.g. ០៣៤).
3. Mark unreadable words as [illegible]. Never guess.
4. Draw one box per text block and assign the closest label.
5. Choose a page label and fill metadata before submitting.`;

export const PROJECT_SEED: Project[] = [
  { id: "P-101", name: "Gazette OCR correction", datasetId: "DS-10482", dataset: "Ministry gazette archive 1994–2003", type: "Text correction", status: "active", deadline: "2026-11-30", reward: 0.4, unit: "page", instructions: DEFAULT_INSTRUCTIONS, annotators: ["Sokha Chan", "Nita Pich", "Chenda Roth", "Dara Vong"], labels: ["Heading", "Paragraph", "Table", "Stamp", "Signature", "Footnote"], created: "2026-09-14", quality: 92 },
  { id: "P-102", name: "Notebook transcription", datasetId: "DS-10540", dataset: "Handwritten school notebooks", type: "Transcription", status: "active", deadline: "2026-11-15", reward: 0.6, unit: "page", instructions: DEFAULT_INSTRUCTIONS, annotators: ["Sokha Chan", "Nita Pich", "Maly Sok"], labels: ["Heading", "Paragraph", "Footnote"], created: "2026-10-01", quality: 84 },
  { id: "P-103", name: "Land title classification", datasetId: "DS-10517", dataset: "Provincial land title scans", type: "Page classification", status: "active", deadline: "2026-11-10", reward: 0.25, unit: "file", instructions: DEFAULT_INSTRUCTIONS, annotators: ["Sokha Chan", "Piseth Mao", "Chenda Roth"], labels: ["Heading", "Stamp", "Signature"], created: "2026-10-08", quality: 88 },
  { id: "P-104", name: "Radio transcript tagging", datasetId: "DS-10566", dataset: "Radio transcripts 2011", type: "Metadata tagging", status: "paused", deadline: "2026-12-20", reward: 0.3, unit: "batch", instructions: DEFAULT_INSTRUCTIONS, annotators: ["Dara Vong", "Maly Sok"], labels: ["Paragraph", "Heading"], created: "2026-10-15", quality: 90 },
  { id: "P-100", name: "Legacy gazette index", datasetId: "DS-10482", dataset: "Ministry gazette archive 1994–2003", type: "Transcription", status: "closed", deadline: "2026-09-30", reward: 0.35, unit: "page", instructions: DEFAULT_INSTRUCTIONS, annotators: ["Nita Pich", "Chenda Roth"], labels: ["Heading", "Paragraph"], created: "2026-07-20", quality: 95 }
];

const PROJECT_BY_NAME: Record<string, string> = { "Gazette OCR correction": "P-101", "Notebook transcription": "P-102", "Land title classification": "P-103" };
const CYCLE: TaskStatus[] = ["approved", "approved", "submitted", "in_progress", "approved", "assigned", "corrections_requested", "approved", "unassigned", "assigned", "in_review", "approved"];
const COUNTS: Record<string, number> = { "P-101": 26, "P-102": 20, "P-103": 16, "P-104": 12, "P-100": 14 };

function mkFeedback(id: string): Feedback[] {
  return [
    { id: `${id}-f1`, author: REVIEWER, at: "2026-10-24 09:12", region: 1, text: "Line 1: the second word is missing a subscript consonant. Please compare with the scan at 200% zoom." },
    { id: `${id}-f2`, author: REVIEWER, at: "2026-10-24 09:14", region: 3, text: "English paragraph: 'commune' was transcribed as 'comune'. Fix spelling." }
  ];
}

function build(): AnnTask[] {
  const out: AnnTask[] = baseTasks.map((t) => ({
    id: t.id, projectId: PROJECT_BY_NAME[t.project] ?? "P-101", file: t.file, page: t.page, pages: 3, assignee: t.assignee,
    status: t.status, deadline: t.deadline, completion: t.completion, quality: t.quality, reward: t.reward, updated: "2026-10-25",
    attempts: t.status === "corrections_requested" ? 2 : 1, feedback: t.status === "corrections_requested" ? mkFeedback(t.id) : [], reviewer: t.status === "submitted" ? undefined : REVIEWER
  }));
  let n = 5600;
  for (const p of PROJECT_SEED) {
    const count = COUNTS[p.id];
    const existing = out.filter((t) => t.projectId === p.id).length;
    for (let i = existing; i < count; i++) {
      n++;
      let status: TaskStatus = p.status === "closed" ? "approved" : CYCLE[(i + n) % CYCLE.length];
      let assignee: string | null = status === "unassigned" ? null : p.annotators[(i * 7 + Math.floor(i / 3)) % p.annotators.length];
      if (p.id === "P-101" && i === existing) { status = "submitted"; assignee = ME; }
      if (p.id === "P-101" && i === existing + 1) { status = "corrections_requested"; assignee = ME; }
      if (p.id === "P-102" && i === existing) { status = "in_review"; assignee = ME; }
      if (p.id === "P-102" && i === existing + 1) { status = "approved"; assignee = ME; }
      const done = status === "approved" || status === "submitted" || status === "in_review";
      out.push({
        id: `T-${n}`, projectId: p.id, file: `${p.id === "P-102" ? "notebook" : p.id === "P-103" ? "title" : "gazette"}_${1994 + (i % 9)}_${String((i % 12) + 1).padStart(2, "0")}.${p.id === "P-102" ? "jpg" : p.id === "P-103" ? "tif" : "pdf"}`,
        page: 1 + ((i * 3) % 14), pages: p.unit === "file" ? 1 : 3, assignee, status,
        deadline: `2026-11-${String(2 + ((i * 2) % 26)).padStart(2, "0")}`,
        completion: done ? 100 : status === "in_progress" ? 20 + ((i * 17) % 70) : status === "corrections_requested" ? 90 : 0,
        quality: status === "approved" ? 80 + ((i * 7) % 19) : status === "corrections_requested" ? 70 + (i % 10) : null,
        reward: p.reward, updated: `2026-10-${String(10 + (i % 16)).padStart(2, "0")}`,
        attempts: status === "corrections_requested" ? 2 : 1, feedback: status === "corrections_requested" ? mkFeedback(`T-${n}`) : [], reviewer: status === "approved" || status === "corrections_requested" || status === "in_review" ? REVIEWER : undefined
      });
    }
  }
  return out;
}
export const TASK_SEED: AnnTask[] = build();

export type ReviewRecord = { id: string; kind: "annotation" | "dataset"; subject: string; ref: string; decision: string; score: number | null; at: string; reviewer: string; annotator?: string; reward?: number; acceptedGb?: number; payable?: number };
export const REVIEW_HISTORY_SEED: ReviewRecord[] = [
  { id: "h1", kind: "annotation", subject: "Gazette OCR correction", ref: "T-5477", decision: "approved", score: 5, at: "2026-10-24 15:02", reviewer: REVIEWER, annotator: ME, reward: 0.6 },
  { id: "h2", kind: "annotation", subject: "Notebook transcription", ref: "T-5490", decision: "corrections_requested", score: 3, at: "2026-10-24 09:14", reviewer: REVIEWER, annotator: "Nita Pich" },
  { id: "h3", kind: "annotation", subject: "Gazette OCR correction", ref: "T-5471", decision: "approved", score: 4, at: "2026-10-23 17:40", reviewer: REVIEWER, annotator: "Chenda Roth", reward: 0.4 },
  { id: "h4", kind: "dataset", subject: "Legal code commentaries v1", ref: "DS-10570", decision: "partially_approved", score: 4, at: "2026-10-22 11:02", reviewer: REVIEWER, acceptedGb: 3.1, payable: 4.65 },
  { id: "h5", kind: "dataset", subject: "Radio transcripts 2011", ref: "DS-10566", decision: "approved", score: 5, at: "2026-10-20 15:40", reviewer: REVIEWER, acceptedGb: 2.4, payable: 3.6 },
  { id: "h6", kind: "dataset", subject: "Stock newspaper clippings", ref: "DS-10401", decision: "rejected", score: 2, at: "2026-10-18 09:15", reviewer: REVIEWER, acceptedGb: 0, payable: 0 }
];

export type DatasetReview = { id: string; datasetId: string; title: string; sizeGb: number; files: number; kind: "raw" | "labeled"; language: string; submitted: string; resubmitted?: boolean; owner: string };
export const DATASET_REVIEWS: DatasetReview[] = [
  { id: "rv-1001", datasetId: "DS-10533", title: "University thesis PDFs (English)", sizeGb: 9.6, files: 412, kind: "raw", language: "English", submitted: "2026-10-18", owner: "Sokha Chan" },
  { id: "rv-1002", datasetId: "DS-10570", title: "Legal code commentaries", sizeGb: 4.7, files: 330, kind: "raw", language: "Khmer", submitted: "2026-10-19", resubmitted: true, owner: "Maly Sok" },
  { id: "rv-1003", datasetId: "DS-10574", title: "Birth register scans Kampot", sizeGb: 18.2, files: 2750, kind: "raw", language: "Khmer", submitted: "2026-10-22", owner: "Vireak Ly" },
  { id: "rv-1004", datasetId: "DS-10551", title: "Market price tables 2020–2025", sizeGb: 1.2, files: 260, kind: "labeled", language: "English", submitted: "2026-10-23", owner: "Sokha Chan" }
];

/* ---------- helpers ---------- */
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { unassigned: "Unassigned", assigned: "Assigned", in_progress: "In progress", submitted: "Submitted", in_review: "In review", corrections_requested: "Corrections requested", approved: "Approved" };
export const TASK_STATUSES = Object.keys(TASK_STATUS_LABEL) as TaskStatus[];
export const TODAY = "2026-10-26";
export const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - new Date(TODAY).getTime()) / 86400000);
export const projectProgress = (tasks: AnnTask[], pid: string) => {
  const t = tasks.filter((x) => x.projectId === pid);
  const done = t.filter((x) => x.status === "approved").length;
  return { total: t.length, done, pct: t.length ? Math.round((done / t.length) * 100) : 0, byStatus: TASK_STATUSES.map((s) => ({ name: TASK_STATUS_LABEL[s], value: t.filter((x) => x.status === s).length })) };
};
export const countBy = (tasks: AnnTask[], s: TaskStatus) => tasks.filter((t) => t.status === s).length;
