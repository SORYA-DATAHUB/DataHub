"use client";
import { useCallback } from "react";
import { useDemoState } from "@/lib/demo";
import { PROJECT_SEED, REVIEWER, REVIEW_HISTORY_SEED, TASK_SEED, type AnnTask, type Project, type ReviewRecord } from "./data";

/** Demo-persisted annotation stores. Each hook owns its state; pages pass values down. */
export function useProjects() {
  const [projects, setProjects] = useDemoState<Project[]>("ann:projects", PROJECT_SEED);
  const patch = useCallback((id: string, p: Partial<Project>) => setProjects((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x))), [setProjects]);
  return { projects, setProjects, patchProject: patch };
}
export function useTasks() {
  const [tasks, setTasks] = useDemoState<AnnTask[]>("ann:tasks", TASK_SEED);
  const patch = useCallback((ids: string[], p: Partial<AnnTask>) => setTasks((l) => l.map((x) => (ids.includes(x.id) ? { ...x, ...p } : x))), [setTasks]);
  return { tasks, setTasks, patchTasks: patch };
}
const DATASET_CLAIMS: Record<string, string> = { "rv-1002": REVIEWER };
export function useClaims(key: "annotation" | "dataset") {
  return useDemoState<Record<string, string>>(`ann:claims:${key}`, key === "dataset" ? DATASET_CLAIMS : {});
}
export function useReviewHistory() {
  const [history, setHistory] = useDemoState<ReviewRecord[]>("ann:history", REVIEW_HISTORY_SEED);
  const add = useCallback((r: ReviewRecord) => setHistory((l) => [r, ...l]), [setHistory]);
  return { history, addRecord: add };
}
