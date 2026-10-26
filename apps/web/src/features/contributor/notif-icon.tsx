import { Banknote, CheckCircle2, CircleDollarSign, ClipboardList, CloudUpload, MessageSquare, PenLine, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NType } from "./data";

const MAP: Record<NType, { icon: LucideIcon; cls: string }> = {
  upload_completed: { icon: CloudUpload, cls: "bg-brand-soft text-brand" },
  dataset_approved: { icon: CheckCircle2, cls: "bg-success-soft text-success" },
  dataset_rejected: { icon: XCircle, cls: "bg-danger-soft text-danger" },
  changes_requested: { icon: PenLine, cls: "bg-warning-soft text-warning" },
  earnings_credited: { icon: CircleDollarSign, cls: "bg-success-soft text-success" },
  withdrawal_approved: { icon: Banknote, cls: "bg-success-soft text-success" },
  payment_completed: { icon: Banknote, cls: "bg-success-soft text-success" },
  new_message: { icon: MessageSquare, cls: "bg-brand-soft text-brand" },
  task_assigned: { icon: ClipboardList, cls: "bg-surface2 text-muted" }
};
export function NotifIcon({ type }: { type: NType }) {
  const { icon: I, cls } = MAP[type];
  return <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", cls)} aria-hidden><I size={15} /></span>;
}
