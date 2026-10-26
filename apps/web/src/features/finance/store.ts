"use client";
import { useCallback } from "react";
import { useDemoState } from "@/lib/demo";
import { payouts as seedPayouts, users, RATES, type Payout } from "@/mock/data";

/* ---------- Demo admin actor (for separation of duties) ---------- */
export type Actor = { name: string; role: "admin" | "super_admin" };
export const ACTORS: Actor[] = [
  { name: "Anna Keller", role: "admin" },
  { name: "Sovann Preap", role: "admin" },
  { name: "Bunthoeun Kim", role: "super_admin" }
];
export const roleLabel = (r: Actor["role"]) => (r === "super_admin" ? "Super administrator" : "Administrator");
export function useActor() {
  const [name, setName] = useDemoState<string>("finance:actor", ACTORS[0].name);
  const actor = ACTORS.find((a) => a.name === name) ?? ACTORS[0];
  return { actor, setActorName: setName };
}

/* ---------- Payouts ---------- */
export type PayoutStatus = Payout["status"];
export type PayoutEvent = { at: string; actor: string; action: string; note?: string };
export type PayoutRec = Payout & {
  wallet: string; events: PayoutEvent[]; approvedBy?: string; paidBy?: string; proof?: string; reason?: string; paidAt?: string;
};
const walletFor = (method: string, userId: string) => method.startsWith("Bank") ? `ABA •••• ${4000 + Number(userId.slice(2)) * 137}` : method === "Wing" ? `Wing 0${12 + Number(userId.slice(2))} 555 ${100 + Number(userId.slice(2))}` : "PayPal on file";
const ts = (d: string) => `${d}T09:00:00`;
function seedRec(p: Payout): PayoutRec {
  const events: PayoutEvent[] = [{ at: ts(p.requested), actor: p.user, action: "Requested payout" }];
  const rec: PayoutRec = { ...p, wallet: walletFor(p.method, p.userId), events };
  const d = (n: number) => { const x = new Date(p.requested); x.setDate(x.getDate() + n); return ts(x.toISOString().slice(0, 10)); };
  if (p.status !== "requested") events.push({ at: d(1), actor: "Anna Keller", action: "Moved to review" });
  if (["approved", "processing", "paid"].includes(p.status)) { rec.approvedBy = "Anna Keller"; events.push({ at: d(2), actor: "Anna Keller", action: "Approved payout" }); }
  if (p.status === "paid") { rec.paidBy = "Sovann Preap"; rec.paidAt = d(3); rec.proof = `${p.reference}-receipt.pdf`; events.push({ at: d(3), actor: "Sovann Preap", action: "Recorded external payment", note: `Ref ${p.reference}` }); }
  if (p.status === "rejected") { rec.reason = "Contributor identity verification still pending."; events.push({ at: d(2), actor: "Anna Keller", action: "Rejected payout", note: rec.reason }); }
  if (p.status === "failed") { rec.reason = "Receiving account was closed."; events.push({ at: d(3), actor: "Sovann Preap", action: "Marked payment failed", note: rec.reason }); }
  return rec;
}
const SEED: PayoutRec[] = seedPayouts.map(seedRec);
export const KNOWN_PAYOUT_IDS = seedPayouts.map((p) => p.id);

export type PayoutAction = "review" | "approve" | "reject" | "processing" | "record" | "failed" | "proof" | "reopen";
export const ACTIVE: PayoutStatus[] = ["requested", "under_review", "approved", "processing"];

export function allowed(p: PayoutRec, a: PayoutAction): boolean {
  switch (a) {
    case "review": return p.status === "requested";
    case "approve": return p.status === "under_review";
    case "reject": return p.status === "requested" || p.status === "under_review";
    case "processing": return p.status === "approved";
    case "record": return p.status === "approved" || p.status === "processing";
    case "failed": return p.status === "processing";
    case "reopen": return p.status === "failed";
    case "proof": return p.status === "processing" || p.status === "paid" || p.status === "approved";
  }
}
/** Separation of duties: approver cannot record the payment. */
export const violatesSoD = (p: PayoutRec, actor: Actor) => !!p.approvedBy && p.approvedBy === actor.name;

export function usePayouts() {
  const [list, setList, reset] = useDemoState<PayoutRec[]>("finance:payouts", SEED);
  const apply = useCallback((id: string, actor: Actor, a: PayoutAction, data?: { note?: string; reference?: string; file?: string }) => {
    const at = new Date().toISOString();
    setList((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const ev = (action: string, note?: string): PayoutEvent[] => [...p.events, { at, actor: actor.name, action, note }];
      switch (a) {
        case "review": return { ...p, status: "under_review", events: ev("Moved to review") };
        case "approve": return { ...p, status: "approved", approvedBy: actor.name, events: ev("Approved payout") };
        case "reject": return { ...p, status: "rejected", reason: data?.note, events: ev("Rejected payout", data?.note) };
        case "processing": return { ...p, status: "processing", events: ev("Marked processing", "External payment initiated manually") };
        case "record": return { ...p, status: "paid", reference: data?.reference, paidBy: actor.name, paidAt: at, events: ev("Recorded external payment", `Ref ${data?.reference}`) };
        case "failed": return { ...p, status: "failed", reason: data?.note, events: ev("Marked payment failed", data?.note) };
        case "reopen": return { ...p, status: "under_review", reason: undefined, events: ev("Reopened for review") };
        case "proof": return { ...p, proof: data?.file, events: ev("Uploaded proof of payment", data?.file) };
      }
    }));
  }, [setList]);
  return { list, apply, reset };
}

/* ---------- Ledger (append-only) ---------- */
export type Adjustment = { id: string; at: string; userId: string; user: string; amount: number; reason: string; by: string };
export function useAdjustments() { return useDemoState<Adjustment[]>("finance:adjustments", []); }
export type LedgerType = "earning" | "reserve" | "release" | "payout" | "adjustment";
export type LedgerEntry = { id: string; date: string; type: LedgerType; user: string; userId: string; amount: number; ref: string; note: string };

export function buildLedger(list: PayoutRec[], adj: Adjustment[]): LedgerEntry[] {
  const e: LedgerEntry[] = [];
  users.filter((u) => u.earnings > 0).forEach((u, i) => {
    e.push({ id: `LG-E${i + 1}`, date: "2026-09-30", type: "earning", user: u.name, userId: u.id, amount: u.earnings, ref: "Approved earnings", note: `${u.acceptedGb} GB accepted at the rates in effect on approval` });
  });
  list.forEach((p) => {
    e.push({ id: `LG-R-${p.id}`, date: p.requested, type: "reserve", user: p.user, userId: p.userId, amount: -p.amount, ref: p.id, note: "Balance reserved for withdrawal request" });
    if (p.status === "paid") e.push({ id: `LG-P-${p.id}`, date: (p.paidAt ?? p.requested).slice(0, 10), type: "payout", user: p.user, userId: p.userId, amount: 0, ref: p.reference ?? p.id, note: "External payment recorded (reserve settled)" });
    if (p.status === "rejected" || p.status === "failed") e.push({ id: `LG-X-${p.id}`, date: (p.events[p.events.length - 1]?.at ?? p.requested).slice(0, 10), type: "release", user: p.user, userId: p.userId, amount: p.amount, ref: p.id, note: `Reserve released (${p.status})` });
  });
  adj.forEach((a) => e.push({ id: a.id, date: a.at.slice(0, 10), type: "adjustment", user: a.user, userId: a.userId, amount: a.amount, ref: "Manual adjustment", note: a.reason }));
  return e.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : x.id < y.id ? 1 : -1));
}

/* ---------- Pricing versions (never edited in place) ---------- */
export type PriceVersion = {
  id: string; version: number; effective: string; raw: number; labeled: number; minWithdrawal: number;
  maxUploadGb: number; maxFileMb: number; categories: string[];
  rewards: Array<{ type: string; reward: number }>; createdBy: string; createdAt: string; note: string;
};
export const REWARD_TYPES = ["Text transcription", "Bounding box / layout", "Quality review"];
export const SEED_PRICING: PriceVersion[] = [{
  id: "PV-1", version: 1, effective: "2026-01-01", raw: RATES.raw, labeled: RATES.labeled, minWithdrawal: RATES.minWithdrawal,
  maxUploadGb: 20, maxFileMb: 500,
  categories: ["PDF documents", "Word documents", "Scanned documents", "Handwritten documents", "Historical documents", "Images", "Text files", "CSV / JSON datasets"],
  rewards: [{ type: "Text transcription", reward: 0.4 }, { type: "Bounding box / layout", reward: 0.25 }, { type: "Quality review", reward: 0.15 }],
  createdBy: "Bunthoeun Kim", createdAt: "2025-12-15", note: "Initial launch pricing"
}];
export function usePricing() { return useDemoState<PriceVersion[]>("finance:pricing", SEED_PRICING); }
export const today = () => new Date().toISOString().slice(0, 10);
export function currentVersion(v: PriceVersion[]) {
  const t = today();
  return [...v].filter((x) => x.effective <= t).sort((a, b) => b.version - a.version)[0] ?? v[0];
}
export const versionState = (v: PriceVersion, all: PriceVersion[]) => v.effective > today() ? "scheduled" : currentVersion(all).id === v.id ? "current" : "superseded";
