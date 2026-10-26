"use client";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Inbox, X } from "lucide-react";
import type { ComponentType, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/* ---------- Card ---------- */
export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface shadow-card", className)} {...p} />;
}
export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div><h2 className="text-sm font-semibold">{title}</h2>{description && <p className="mt-0.5 text-xs text-muted">{description}</p>}</div>
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */
export type Tone = "neutral" | "brand" | "success" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-surface2 text-muted", brand: "bg-brand-soft text-brand", success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger"
};
export function Badge({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}{children}
    </span>
  );
}
const statusTone: Record<string, Tone> = {
  uploading: "brand", processing: "brand", pending_review: "warning", in_review: "warning", changes_requested: "warning",
  partially_approved: "brand", approved: "success", rejected: "danger", draft: "neutral", failed: "danger",
  requested: "warning", under_review: "warning", processing_payment: "brand", paid: "success", active: "success",
  pending: "warning", suspended: "danger", verified: "success", unverified: "neutral", open: "brand", closed: "neutral",
  completed: "success", in_progress: "brand", assigned: "neutral", submitted: "warning", corrections_requested: "warning",
  paused: "neutral", ok: "success", success: "success", denied: "danger", error: "danger", ready: "success", queued: "neutral",
  accepted: "success", duplicate: "warning", available: "success", reserved: "warning"
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? "neutral"} dot>{status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

/* ---------- Form controls ---------- */
const control = "w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted/70 transition-colors hover:border-muted/50 focus-visible:border-brand disabled:opacity-50 aria-[invalid=true]:border-danger";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, "h-9", className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-24 py-2", className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cn(control, "h-9 pr-8", className)} {...p} />;
});
export function Field({ label, hint, error, children, required }: { label: string; hint?: string; error?: string; required?: boolean; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const d = error ? `${id}-e` : hint ? `${id}-h` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}{required && <span className="text-danger" aria-hidden> *</span>}</label>
      {children(id, d)}
      {error ? <p id={d} role="alert" className="text-xs text-danger">{error}</p> : hint ? <p id={d} className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-line")}>
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

/* ---------- Progress / Skeleton / Avatar ---------- */
export function Progress({ value, tone = "brand", label }: { value: number; tone?: "brand" | "success" | "warning" | "danger"; label?: string }) {
  const c = { brand: "bg-brand", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
      <div className={cn("h-full rounded-full transition-all", c)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export const Skeleton = ({ className }: { className?: string }) => <div className={cn("skeleton", className)} aria-hidden />;
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const initials = name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 55% 45%)` }}>{initials}</span>;
}

/* ---------- Alerts and states ---------- */
const alertIcon = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: AlertCircle };
const alertTone = { info: "bg-brand-soft text-brand", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger" };
export function Alert({ tone = "info", title, children, action }: { tone?: keyof typeof alertIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  const Icon = alertIcon[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg p-3.5 text-sm", alertTone[tone])}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p>{children && <div className="mt-0.5 text-fg/80">{children}</div>}</div>
      {action}
    </div>
  );
}
export function EmptyState({ icon: Icon = Inbox, title, description, action }: { icon?: ComponentType<{ size?: number }>; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface2 text-muted"><Icon size={22} /></span>
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({ title = "Something went wrong", description = "We couldn't load this. Please try again.", onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return <EmptyState icon={AlertCircle} title={title} description={description} action={onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>} />;
}
export function DeniedState({ role }: { role: string }) {
  return <EmptyState icon={AlertTriangle} title="You don't have access to this area" description={`This workspace requires the ${role} role. Ask a Super Administrator to grant it.`} action={<Button href="/dashboard" variant="outline">Back to dashboard</Button>} />;
}

/* ---------- Page chrome ---------- */
export function PageHeader({ title, description, actions, breadcrumbs }: { title: string; description?: string; actions?: ReactNode; breadcrumbs?: Array<{ label: string; href?: string }> }) {
  return (
    <header className="mb-6">
      {breadcrumbs && (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {breadcrumbs.map((b, i) => (<span key={b.label} className="flex items-center gap-1.5">{i > 0 && <span aria-hidden>/</span>}{b.href ? <a href={b.href} className="hover:text-fg">{b.label}</a> : <span aria-current="page" className="text-fg">{b.label}</span>}</span>))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}</div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
export function Stat({ label, value, hint, icon: Icon, tone = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ComponentType<{ size?: number }>; tone?: Tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted">{label}</p>{Icon && <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", tones[tone])}><Icon size={15} /></span>}</div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}
export function CloseButton({ onClick }: { onClick: () => void }) {
  return <Button variant="ghost" size="icon" onClick={onClick} aria-label="Close"><X size={16} /></Button>;
}
