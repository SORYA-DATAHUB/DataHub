"use client";
import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useRef, useState, type ClipboardEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { Card, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function AuthCard({ title, description, children, footer, icon }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; icon?: ReactNode }) {
  return (
    <div>
      <Card className="p-6 shadow-pop sm:p-8">
        {icon && <div className="mb-4">{icon}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </Card>
      {footer && <p className="mt-5 text-center text-sm text-muted">{footer}</p>}
    </div>
  );
}

export function IconBadge({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "success" | "danger" | "warning" }) {
  const t = { brand: "bg-brand-soft text-brand", success: "bg-success-soft text-success", danger: "bg-danger-soft text-danger", warning: "bg-warning-soft text-warning" }[tone];
  return <span className={cn("flex h-12 w-12 items-center justify-center rounded-full", t)}>{children}</span>;
}

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordInput({ className, ...p }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} className={cn("pr-10", className)} {...p} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
        className="absolute right-1 top-1 flex h-7 w-8 items-center justify-center rounded-md text-muted hover:bg-surface2 hover:text-fg">
        {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      </button>
    </div>
  );
});

export function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, Math.max(pw ? 1 : 0, s - (pw.length < 8 ? 1 : 0)));
}
const LABELS = ["", "Weak", "Fair", "Good", "Strong"];
export function StrengthMeter({ password }: { password: string }) {
  const score = passwordScore(password);
  const color = ["bg-line", "bg-danger", "bg-warning", "bg-brand", "bg-success"][score];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= score ? color : "bg-surface2")} />)}</div>
      <p className="mt-1 text-xs text-muted">{password ? `Password strength: ${LABELS[score]}` : "Use 8+ characters with upper and lower case letters, a number and a symbol."}</p>
    </div>
  );
}

/** Six-box one-time code input with paste and arrow/backspace support. */
export function OtpInput({ value, onChange, invalid, disabled, label = "6-digit verification code" }: { value: string; onChange: (v: string) => void; invalid?: boolean; disabled?: boolean; label?: string }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  const set = (i: number, d: string) => { const a = [...digits]; a[i] = d; onChange(a.join("")); };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) { refs.current[i - 1]?.focus(); set(i - 1, ""); }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };
  const onPaste = (e: ClipboardEvent) => {
    const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (t) { e.preventDefault(); onChange(t); refs.current[Math.min(t.length, 5)]?.focus(); }
  };
  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2" onPaste={onPaste}>
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} value={d} disabled={disabled} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={1}
          aria-label={`Digit ${i + 1}`} aria-invalid={invalid || undefined}
          onChange={(e) => { const c = e.target.value.replace(/\D/g, "").slice(-1); set(i, c); if (c && i < 5) refs.current[i + 1]?.focus(); }}
          onKeyDown={(e) => onKey(i, e)} onFocus={(e) => e.target.select()}
          className="tabular h-12 w-full min-w-0 rounded-lg border border-line bg-surface text-center text-lg font-semibold hover:border-muted/50 focus-visible:border-brand disabled:opacity-50 aria-[invalid=true]:border-danger" />
      ))}
    </div>
  );
}

/** Only allow same-origin relative redirects. */
export const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : null);
export const DEMO_PASSWORD = "demo1234";
export const DEMO_HOME: Record<string, string> = { "admin@datahub.demo": "/admin", "review@datahub.demo": "/review", "annotate@datahub.demo": "/annotate" };
