"use client";
import { Calendar } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import { Badge, Progress, StatusBadge } from "@/components/ui/primitives";
import { cn, dateFmt } from "@/lib/cn";
import { daysLeft, TASK_STATUS_LABEL, type AnnTask, type ProjectStatus, type TaskStatus } from "./data";

/** Query-string synced state (replace, no scroll). */
export function useQueryState<T extends string>(key: string, def: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const sp = useSearchParams(); const router = useRouter(); const path = usePathname();
  const raw = sp.get(key) as T | null;
  const value = raw && (!allowed || allowed.includes(raw)) ? raw : def;
  const set = useCallback((v: T) => {
    const q = new URLSearchParams(sp.toString());
    if (v === def) q.delete(key); else q.set(key, v);
    const s = q.toString();
    router.replace(s ? `${path}?${s}` : path, { scroll: false });
  }, [sp, router, path, key, def]);
  return [value, set];
}

export const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => <StatusBadge status={status === "draft" ? "draft" : status} />;
export const TaskStatusBadge = ({ status }: { status: TaskStatus }) => status === "unassigned" ? <Badge dot>{TASK_STATUS_LABEL[status]}</Badge> : <StatusBadge status={status} />;

export function Deadline({ iso, done }: { iso: string; done?: boolean }) {
  const d = daysLeft(iso);
  const tone = done ? "text-muted" : d < 0 ? "text-danger" : d <= 5 ? "text-warning" : "text-muted";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", tone)}>
      <Calendar size={12} aria-hidden />{dateFmt(iso)}{!done && <span className="font-medium">· {d < 0 ? `${-d}d overdue` : d === 0 ? "today" : `${d}d left`}</span>}
    </span>
  );
}
export function ProgressCell({ value, label }: { value: number; label?: string }) {
  return (
    <div className="min-w-28">
      <div className="mb-1 flex justify-between text-xs"><span className="tabular font-medium">{value}%</span>{label && <span className="text-muted">{label}</span>}</div>
      <Progress value={value} tone={value >= 100 ? "success" : "brand"} label={label} />
    </div>
  );
}
export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="mb-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{title}</h2>{action}</div>{children}</section>;
}
export const taskUrl = (t: AnnTask) => `/annotate/tasks/${t.id}`;
export const isKhmer = (s: string) => /[ក-៿]/.test(s);
export const money = (n: number) => `$${n.toFixed(2)}`;
