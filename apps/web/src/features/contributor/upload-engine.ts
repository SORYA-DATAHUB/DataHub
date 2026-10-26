"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ACCEPTED_FORMATS } from "@/mock/data";
import { KNOWN_FILES } from "./data";

/** Simulated upload engine. No bytes ever leave the browser: it only animates progress for the selected files. */
export type UpStatus = "queued" | "uploading" | "paused" | "done" | "failed" | "duplicate" | "invalid";
export type UpFile = { id: string; name: string; path?: string; size: number; progress: number; status: UpStatus; error?: string; speed: number; failAt?: number };
export type Incoming = { name: string; size: number; path?: string; failAt?: number };

export const MB = 1048576;
export const MAX_FILE = 4 * 1024 * MB;
export const SAMPLE_FILES: Incoming[] = [
  { name: "gazette_1996_01.pdf", size: 412 * MB }, { name: "gazette_1996_02.pdf", size: 388 * MB },
  { name: "gazette_1996_03.pdf", size: 401 * MB }, { name: "scan_0007_corrupt.tif", size: 856 * MB, failAt: 62 },
  { name: "register_pages_batch_a.zip", size: 1240 * MB }, { name: "index_cards_0001.jpg", size: 214 * MB },
  { name: "notes_summary.docx", size: 38 * MB }, { name: "readme.exe", size: 2 * MB }
];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
let seq = 0;

export function classify(i: Incoming, existing: UpFile[]): UpFile {
  const base: UpFile = { id: `u${Date.now().toString(36)}${seq++}`, name: i.name, path: i.path, size: i.size, progress: 0, status: "queued", speed: 0, failAt: i.failAt };
  const ext = i.name.split(".").pop()?.toUpperCase() ?? "";
  if (!(ACCEPTED_FORMATS as readonly string[]).includes(ext)) return { ...base, status: "invalid", error: `.${ext.toLowerCase()} is not an accepted format` };
  if (i.size <= 0) return { ...base, status: "invalid", error: "File is empty" };
  if (i.size > MAX_FILE) return { ...base, status: "invalid", error: "File is larger than 4 GB" };
  if (existing.some((f) => f.name === i.name && f.size === i.size) || KNOWN_FILES.includes(i.name)) return { ...base, status: "duplicate", error: "Duplicate: this file already exists. It will not earn." };
  return base;
}

export function useUploadQueue(initial: UpFile[] = []) {
  const [files, setFiles] = useState<UpFile[]>(initial);
  const tick = useRef(0);
  const live = files.some((f) => f.status === "uploading" || f.status === "queued");

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      tick.current += 1;
      setFiles((prev) => {
        let active = prev.filter((f) => f.status === "uploading").length;
        return prev.map((f) => {
          let cur = f;
          if (cur.status === "queued" && active < 3) { active++; cur = { ...cur, status: "uploading" }; }
          if (cur.status !== "uploading") return cur;
          const speed = (36 + (hash(cur.id) % 40)) * MB * (0.85 + 0.3 * (((tick.current + hash(cur.id)) % 7) / 7));
          const inc = Math.min(22, Math.max(3, ((speed * 0.4) / Math.max(cur.size, 1)) * 100));
          const progress = Math.min(100, cur.progress + inc);
          if (cur.failAt !== undefined && progress >= cur.failAt) return { ...cur, progress: cur.failAt, status: "failed", speed: 0, error: "Connection lost while uploading. Retry resumes from the last completed part." };
          if (progress >= 100) return { ...cur, progress: 100, status: "done", speed: 0 };
          return { ...cur, progress, speed };
        });
      });
    }, 400);
    return () => clearInterval(t);
  }, [live]);

  const add = useCallback((list: Incoming[]) => setFiles((p) => { const out = [...p]; list.forEach((i) => out.push(classify(i, out))); return out; }), []);
  const update = useCallback((id: string, fn: (f: UpFile) => UpFile) => setFiles((p) => p.map((f) => (f.id === id ? fn(f) : f))), []);
  const pause = useCallback((id: string) => update(id, (f) => (f.status === "uploading" || f.status === "queued" ? { ...f, status: "paused", speed: 0 } : f)), [update]);
  const resume = useCallback((id: string) => update(id, (f) => (f.status === "paused" ? { ...f, status: "queued" } : f)), [update]);
  const retry = useCallback((id: string) => update(id, (f) => (f.status === "failed" ? { ...f, status: "queued", error: undefined, failAt: undefined } : f)), [update]);
  const remove = useCallback((id: string) => setFiles((p) => p.filter((f) => f.id !== id)), []);
  const pauseAll = useCallback(() => setFiles((p) => p.map((f) => (f.status === "uploading" || f.status === "queued" ? { ...f, status: "paused", speed: 0 } : f))), []);
  const resumeAll = useCallback(() => setFiles((p) => p.map((f) => (f.status === "paused" ? { ...f, status: "queued" } : f))), []);
  const retryAll = useCallback(() => setFiles((p) => p.map((f) => (f.status === "failed" ? { ...f, status: "queued", error: undefined, failAt: undefined } : f))), []);
  const clear = useCallback(() => setFiles([]), []);

  const stats = useMemo(() => {
    const counted = files.filter((f) => f.status !== "duplicate" && f.status !== "invalid");
    const total = counted.reduce((a, f) => a + f.size, 0);
    const done = counted.reduce((a, f) => a + (f.size * f.progress) / 100, 0);
    const speed = files.reduce((a, f) => a + (f.status === "uploading" ? f.speed : 0), 0);
    const by = (s: UpStatus) => files.filter((f) => f.status === s).length;
    return {
      total, done, pct: total ? (done / total) * 100 : 0, speed, eta: speed > 0 ? (total - done) / speed : 0,
      doneBytes: files.filter((f) => f.status === "done").reduce((a, f) => a + f.size, 0),
      count: { done: by("done"), failed: by("failed"), duplicate: by("duplicate"), invalid: by("invalid"), active: by("uploading") + by("queued"), paused: by("paused") }
    };
  }, [files]);
  return { files, add, pause, resume, retry, remove, pauseAll, resumeAll, retryAll, clear, setFiles, stats };
}

export const fmtEta = (s: number) => (s <= 0 ? "-" : s < 60 ? `${Math.ceil(s)}s` : `${Math.floor(s / 60)}m ${Math.ceil(s % 60)}s`);
