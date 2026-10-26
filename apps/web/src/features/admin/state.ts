"use client";
import { useCallback, useMemo } from "react";
import { useDemoState } from "@/lib/demo";
import { datasets, users, type Dataset, type DatasetStatus, type User } from "@/mock/data";
import { verificationsSeed, type Verification } from "./data";

export function useUsers() {
  const [ov, setOv] = useDemoState<Record<string, Partial<User>>>("admin-user-overrides", {});
  const merged = useMemo(() => users.map((u) => ({ ...u, ...ov[u.id] })), [ov]);
  const patch = useCallback((id: string, p: Partial<User>) => setOv((o) => ({ ...o, [id]: { ...o[id], ...p } })), [setOv]);
  return { users: merged, patch };
}

export type DatasetOverride = { status?: DatasetStatus; takedown?: boolean };
export function useDatasets() {
  const [ov, setOv] = useDemoState<Record<string, DatasetOverride>>("admin-dataset-overrides", {});
  const merged = useMemo<Array<Dataset & { takedown: boolean }>>(() => datasets.map((d) => ({ ...d, ...(ov[d.id]?.status ? { status: ov[d.id].status! } : {}), takedown: !!ov[d.id]?.takedown })), [ov]);
  const patch = useCallback((id: string, p: DatasetOverride) => setOv((o) => ({ ...o, [id]: { ...o[id], ...p } })), [setOv]);
  return { datasets: merged, patch };
}

export function useVerifications() {
  const [list, setList] = useDemoState<Verification[]>("admin-verifications", verificationsSeed);
  const decide = useCallback((id: string, status: "approved" | "rejected", text: string) =>
    setList((l) => l.map((v) => (v.id === id ? { ...v, status, history: [{ at: "2026-10-26", text }, ...v.history] } : v))), [setList]);
  return { list, decide };
}

export type AdminNote = { id: string; at: string; text: string };
export function useUserNotes(userId: string) {
  const [notes, setNotes] = useDemoState<AdminNote[]>(`admin-notes-${userId}`, []);
  const add = (text: string) => setNotes((n) => [{ id: String(Date.now()), at: "2026-10-26", text }, ...n]);
  return { notes, add };
}
