import type { Conversation } from "@/features/messaging/types";

export const ME_ID = "u-1";
const me = { authorId: ME_ID, authorName: "Sokha Chan", authorRole: "Contributor" as const };
export const convoSeeds: Conversation[] = [
  {
    id: "c-1", subject: "Payout method verification", topic: "payout", unread: 1, updatedAt: "2026-10-25T09:20:00Z",
    counterpart: { id: "s-1", name: "DataHub Support", role: "Support" },
    messages: [
      { id: "m1", ...me, body: "Hi, my Wing payout method shows as pending. How long does verification take?", at: "2026-10-24T08:02:00Z" },
      { id: "m2", authorId: "s-1", authorName: "DataHub Support", authorRole: "Support", body: "Hello Sokha! Verification usually takes 1 business day. Could you upload a screenshot of your Wing profile showing the account name?", at: "2026-10-24T10:40:00Z" },
      { id: "m3", authorId: "s-1", authorName: "DataHub Support", authorRole: "Support", body: "We need one more detail: the name on the Wing account must match your verified identity.", at: "2026-10-25T09:20:00Z" }
    ]
  },
  {
    id: "c-2", subject: "Handwritten school notebooks: rescans", topic: "dataset", datasetId: "DS-10540", unread: 1, updatedAt: "2026-10-23T14:05:00Z",
    counterpart: { id: "u-4", name: "Vireak Ly", role: "Reviewer" },
    messages: [
      { id: "m1", authorId: "u-4", authorName: "Vireak Ly", authorRole: "Reviewer", body: "Pages 120 to 180 are blurry. Could you rescan at 300 DPI or higher?", at: "2026-10-23T11:30:00Z" },
      { id: "m2", ...me, body: "Yes, I can. Do you also need the cover pages?", at: "2026-10-23T13:12:00Z" },
      { id: "m3", authorId: "u-4", authorName: "Vireak Ly", authorRole: "Reviewer", body: "Cover pages are fine as they are. Replace the blurry ones and resubmit when ready.", at: "2026-10-23T14:05:00Z", attachments: [{ name: "blurry_pages_list.csv", sizeKb: 12 }] }
    ]
  },
  {
    id: "c-3", subject: "Why was part of DS-10517 rejected?", topic: "dataset", datasetId: "DS-10517", unread: 0, updatedAt: "2026-09-20T16:00:00Z",
    counterpart: { id: "a-1", name: "Anna Keller", role: "Administrator" },
    messages: [
      { id: "m1", ...me, body: "About 5 GB of my land title scans were rejected. Can you explain what to fix?", at: "2026-09-19T09:00:00Z" },
      { id: "m2", authorId: "a-1", authorName: "Anna Keller", authorRole: "Administrator", body: "Those files contained unredacted personal data. Please redact national ID numbers and upload them again.", at: "2026-09-20T16:00:00Z" }
    ]
  },
  {
    id: "c-4", subject: "How is the quality score computed?", topic: "support", unread: 0, updatedAt: "2026-09-02T12:00:00Z",
    counterpart: { id: "s-1", name: "DataHub Support", role: "Support" },
    messages: [
      { id: "m1", ...me, body: "How is the quality score computed?", at: "2026-09-02T10:00:00Z" },
      { id: "m2", authorId: "s-1", authorName: "DataHub Support", authorRole: "Support", body: "It combines readability, duplicate rate and metadata completeness. Only accepted, unique and eligible data earns money, and the score does not change your rate.", at: "2026-09-02T12:00:00Z" }
    ]
  }
];
