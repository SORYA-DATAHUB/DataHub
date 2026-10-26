export type Attachment = { name: string; sizeKb: number };
export type Msg = { id: string; authorId: string; authorName: string; authorRole?: "Administrator" | "Reviewer" | "Support" | "Contributor"; body: string; at: string; attachments?: Attachment[] };
export type Topic = "support" | "dataset" | "payout" | "account" | "general";
export const TOPIC_LABEL: Record<Topic, string> = { support: "Technical support", dataset: "Dataset review", payout: "Payouts", account: "Account & verification", general: "General" };
export type Counterpart = { id: string; name: string; role: "Administrator" | "Reviewer" | "Support" | "Contributor" };
export type Conversation = {
  id: string; subject: string; topic: Topic; datasetId?: string; counterpart: Counterpart;
  messages: Msg[]; unread: number; updatedAt: string;
};
