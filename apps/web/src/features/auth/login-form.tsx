"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/ui/overlays";
import { Alert, Field, Input } from "@/components/ui/primitives";
import { wait, useDemoState } from "@/lib/demo";
import { AuthCard, DEMO_HOME, DEMO_PASSWORD, IconBadge, OtpInput, PasswordInput, safeNext } from "./auth-ui";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean()
});
type Values = z.infer<typeof schema>;
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 20;

function useCountdown(seconds: number, setSeconds: (n: number) => void) {
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, setSeconds]);
}

export function LoginForm() {
  const params = useSearchParams();
  return params.get("step") === "mfa" ? <MfaStep next={safeNext(params.get("next"))} /> : <PasswordStep next={safeNext(params.get("next"))} reason={params.get("reason")} />;
}

function PasswordStep({ next, reason }: { next: string | null; reason: string | null }) {
  const router = useRouter();
  const { toast } = useUI();
  const [, setSession] = useDemoState<{ email: string; remember: boolean } | null>("session", null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lock, setLock] = useState(0);
  useCountdown(lock, setLock);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "", remember: true } });

  const onSubmit = async (v: Values) => {
    setError(null);
    await wait(800);
    const email = v.email.toLowerCase();
    if (email === "offline@datahub.demo") { setError("We could not reach the server. Check your connection and try again."); return; }
    if (v.password !== DEMO_PASSWORD) {
      const n = attempts + 1; setAttempts(n);
      if (n >= MAX_ATTEMPTS) { setLock(LOCK_SECONDS); setAttempts(0); setError("Too many attempts."); }
      else setError("Incorrect email or password.");
      return;
    }
    setSession({ email, remember: v.remember });
    const dest = next ?? DEMO_HOME[email] ?? "/dashboard";
    toast("Signed in (demo session).");
    router.push(email === "admin@datahub.demo" ? `/login?step=mfa&next=${encodeURIComponent(dest)}` : dest);
  };
  const locked = lock > 0;

  return (
    <AuthCard title="Welcome back" description="Sign in to your DataHub account." footer={<>New to DataHub? <Link href="/register" className="font-medium text-brand hover:underline">Create an account</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {reason === "expired" && <Alert tone="warning" title="Session expired">Please sign in again to continue.</Alert>}
        {locked ? <Alert tone="danger" title="Too many attempts">Try again in {lock} s.</Alert> : error && <Alert tone="danger" title={error}>{error.startsWith("We could") ? "This is a simulated network error." : `Check your details and try again.${attempts ? ` ${MAX_ATTEMPTS - attempts} attempts left.` : ""}`}</Alert>}
        <Field label="Email" error={errors.email?.message}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.email} type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />}</Field>
        <Field label="Password" error={errors.password?.message}>{(id, d) => <PasswordInput id={id} aria-describedby={d} aria-invalid={!!errors.password} autoComplete="current-password" {...register("password")} />}</Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" {...register("remember")} />Remember me</label>
          <Link href="/forgot-password" className="font-medium text-brand hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting} disabled={locked}>{isSubmitting ? "Signing in…" : "Sign in"}</Button>
      </form>
      <div className="mt-6 rounded-lg bg-surface2 p-3 text-xs text-muted">
        <p className="font-medium text-fg">Demo credentials</p>
        <p className="mt-1">Any email with password <code className="font-mono text-fg">{DEMO_PASSWORD}</code>. Try <code className="font-mono">admin@datahub.demo</code>, <code className="font-mono">review@datahub.demo</code> or <code className="font-mono">annotate@datahub.demo</code>.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[["Contributor", "sokha.chan@example.com"], ["Admin", "admin@datahub.demo"], ["Reviewer", "review@datahub.demo"], ["Annotator", "annotate@datahub.demo"]].map(([l, e]) => (
            <button key={e} type="button" className="rounded-md border border-line bg-surface px-2 py-1 font-medium text-fg hover:bg-bg" onClick={() => { setValue("email", e, { shouldValidate: true }); setValue("password", DEMO_PASSWORD, { shouldValidate: true }); }}>{l}</button>
          ))}
        </div>
      </div>
    </AuthCard>
  );
}

function MfaStep({ next }: { next: string | null }) {
  const router = useRouter();
  const { toast } = useUI();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrong, setWrong] = useState(0);
  const [lock, setLock] = useState(0);
  useCountdown(lock, setLock);

  const verify = async () => {
    if (code.length < 6) { setError("Enter all 6 digits."); return; }
    setBusy(true); setError(null); await wait(700);
    if (code === "123456") { toast("Verified. Welcome back."); router.push(next ?? "/dashboard"); return; }
    setBusy(false); setCode("");
    const n = wrong + 1; setWrong(n);
    if (n >= 3) { setLock(LOCK_SECONDS); setWrong(0); setError("Too many attempts."); } else setError("That code is incorrect or expired.");
  };

  return (
    <AuthCard icon={<IconBadge><ShieldCheck size={22} aria-hidden /></IconBadge>} title="Two-step verification" description="Enter the 6-digit code from your authenticator app."
      footer={<Link href="/login" className="font-medium text-brand hover:underline">Back to sign in</Link>}>
      <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="space-y-4" noValidate>
        {lock > 0 ? <Alert tone="danger" title="Too many attempts">Try again in {lock} s.</Alert> : error && <Alert tone="danger" title={error} />}
        <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} invalid={!!error} disabled={busy || lock > 0} />
        <Button type="submit" className="w-full" size="lg" loading={busy} disabled={lock > 0}>Verify</Button>
      </form>
      <p className="mt-5 text-xs text-muted">Demo: the code is <code className="font-mono text-fg">123456</code>. Lost your device? <Link href="/help#contact" className="text-brand hover:underline">Contact support</Link>.</p>
    </AuthCard>
  );
}
