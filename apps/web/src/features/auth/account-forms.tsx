"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, MailCheck, MailQuestion } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/ui/overlays";
import { Alert, Field, Input } from "@/components/ui/primitives";
import { wait } from "@/lib/demo";
import { AuthCard, IconBadge, PasswordInput, StrengthMeter, passwordScore } from "./auth-ui";

const password = z.string().min(8, "Use at least 8 characters.").refine((p) => passwordScore(p) >= 2, "Password is too weak. Add upper case letters, numbers or symbols.");
const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email address."),
  password, confirm: z.string().min(1, "Confirm your password."),
  terms: z.boolean().refine((v) => v, "You must accept the terms to continue.")
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });
type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const { toast } = useUI();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, control, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { name: "", email: "", password: "", confirm: "", terms: false } });
  const pw = useWatch({ control, name: "password" });

  const onSubmit = async (v: RegisterValues) => {
    setError(null); await wait(1000);
    if (v.email.toLowerCase() === "taken@example.com") { setFieldError("email", { message: "An account with this email already exists. Try signing in." }); return; }
    if (v.email.toLowerCase() === "offline@example.com") { setError("We could not create your account. Please try again."); return; }
    toast("Account created (demo). Check your inbox.");
    router.push(`/verify-email?email=${encodeURIComponent(v.email)}`);
  };

  return (
    <AuthCard title="Create your account" description="Start contributing authorized data in minutes." footer={<>Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error && <Alert tone="danger" title={error} />}
        <Field label="Full name" error={errors.name?.message} required>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.name} autoComplete="name" {...register("name")} />}</Field>
        <Field label="Email" error={errors.email?.message} hint="Try taken@example.com to see a conflict error." required>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.email} type="email" autoComplete="email" {...register("email")} />}</Field>
        <div>
          <Field label="Password" error={errors.password?.message} required>{(id, d) => <PasswordInput id={id} aria-describedby={d} aria-invalid={!!errors.password} autoComplete="new-password" {...register("password")} />}</Field>
          <StrengthMeter password={pw ?? ""} />
        </div>
        <Field label="Confirm password" error={errors.confirm?.message} required>{(id, d) => <PasswordInput id={id} aria-describedby={d} aria-invalid={!!errors.confirm} autoComplete="new-password" {...register("confirm")} />}</Field>
        <div>
          <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--brand)]" aria-invalid={!!errors.terms} {...register("terms")} /><span>I agree to the <Link href="/legal/terms" className="text-brand hover:underline" target="_blank">Terms of Service</Link> and <Link href="/legal/privacy" className="text-brand hover:underline" target="_blank">Privacy Policy</Link>.</span></label>
          {errors.terms && <p role="alert" className="mt-1.5 text-xs text-danger">{errors.terms.message}</p>}
        </div>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>{isSubmitting ? "Creating account…" : "Create account"}</Button>
      </form>
    </AuthCard>
  );
}

export function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get("token");
  return token ? <TokenVerify token={token} /> : <CheckInbox email={params.get("email")} />;
}

function CheckInbox({ email }: { email: string | null }) {
  const { toast } = useUI();
  const [cool, setCool] = useState(30);
  const [sending, setSending] = useState(false);
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);
  const resend = async () => { setSending(true); await wait(800); setSending(false); setCool(30); toast("Verification email re-sent (demo)."); };
  return (
    <AuthCard icon={<IconBadge><MailQuestion size={22} aria-hidden /></IconBadge>} title="Check your inbox" description={<>We sent a verification link to <strong className="text-fg">{email ?? "your email address"}</strong>. It expires in 24 hours.</>}
      footer={<>Wrong address? <Link href="/register" className="font-medium text-brand hover:underline">Start over</Link></>}>
      <div className="space-y-3">
        <Button variant="outline" className="w-full" onClick={resend} disabled={cool > 0} loading={sending}>{cool > 0 ? `Resend email in ${cool}s` : "Resend verification email"}</Button>
        <div className="rounded-lg bg-surface2 p-3 text-xs text-muted">Demo mode: no email is sent. <Link href="/verify-email?token=demo-token" className="font-medium text-brand hover:underline">Open the demo verification link</Link></div>
      </div>
    </AuthCard>
  );
}

function TokenVerify({ token }: { token: string }) {
  const [state, setState] = useState<"loading" | "ok" | "expired">("loading");
  useEffect(() => { let on = true; wait(1100).then(() => on && setState(token === "expired" ? "expired" : "ok")); return () => { on = false; }; }, [token]);
  if (state === "loading") return <AuthCard icon={<IconBadge><Loader2 className="animate-spin" size={22} aria-hidden /></IconBadge>} title="Verifying your email…" description="This only takes a moment."><div role="status" className="sr-only">Verifying</div></AuthCard>;
  if (state === "expired") return (
    <AuthCard icon={<IconBadge tone="danger"><AlertTriangle size={22} aria-hidden /></IconBadge>} title="Link expired" description="This verification link is invalid or has expired.">
      <Button href="/verify-email" className="w-full">Request a new link</Button>
    </AuthCard>
  );
  return (
    <AuthCard icon={<IconBadge tone="success"><MailCheck size={22} aria-hidden /></IconBadge>} title="Email verified" description="Your account is active. Next, finish a short onboarding so you can upload your first dataset.">
      <Button href="/onboarding" size="lg" className="w-full">Continue to onboarding</Button>
    </AuthCard>
  );
}

const forgotSchema = z.object({ email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email address.") });
export function ForgotPasswordForm() {
  const [sent, setSent] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  if (sent) return (
    <AuthCard icon={<IconBadge tone="success"><MailCheck size={22} aria-hidden /></IconBadge>} title="Check your email" description={<>If an account exists for <strong className="text-fg">{sent}</strong>, we sent a link to reset your password.</>} footer={<Link href="/login" className="font-medium text-brand hover:underline">Back to sign in</Link>}>
      <div className="rounded-lg bg-surface2 p-3 text-xs text-muted">Demo mode: no email is sent. <Link href="/reset-password?token=demo-token" className="font-medium text-brand hover:underline">Open the demo reset link</Link></div>
    </AuthCard>
  );
  return (
    <AuthCard title="Reset your password" description="Enter your email and we will send you a reset link." footer={<Link href="/login" className="font-medium text-brand hover:underline">Back to sign in</Link>}>
      <form onSubmit={handleSubmit(async (v) => { await wait(900); setSent(v.email); })} noValidate className="space-y-4">
        <Field label="Email" error={errors.email?.message}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.email} type="email" autoComplete="email" {...register("email")} />}</Field>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>Send reset link</Button>
      </form>
    </AuthCard>
  );
}

const resetSchema = z.object({ password, confirm: z.string().min(1, "Confirm your password.") }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });
export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const [done, setDone] = useState(false);
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } });
  const pw = useWatch({ control, name: "password" });
  if (!token || token === "expired") return (
    <AuthCard icon={<IconBadge tone="danger"><AlertTriangle size={22} aria-hidden /></IconBadge>} title="Reset link invalid" description="This link is missing, invalid or has expired. Request a new one.">
      <Button href="/forgot-password" className="w-full">Request a new link</Button>
    </AuthCard>
  );
  if (done) return (
    <AuthCard icon={<IconBadge tone="success"><CheckCircle2 size={22} aria-hidden /></IconBadge>} title="Password updated" description="You can now sign in with your new password. Other devices were signed out.">
      <Button href="/login" size="lg" className="w-full">Sign in</Button>
    </AuthCard>
  );
  return (
    <AuthCard icon={<IconBadge><KeyRound size={22} aria-hidden /></IconBadge>} title="Choose a new password" description="Make it at least 8 characters and hard to guess.">
      <form onSubmit={handleSubmit(async () => { await wait(900); setDone(true); })} noValidate className="space-y-4">
        <div>
          <Field label="New password" error={errors.password?.message} required>{(id, d) => <PasswordInput id={id} aria-describedby={d} aria-invalid={!!errors.password} autoComplete="new-password" {...register("password")} />}</Field>
          <StrengthMeter password={pw ?? ""} />
        </div>
        <Field label="Confirm new password" error={errors.confirm?.message} required>{(id, d) => <PasswordInput id={id} aria-describedby={d} aria-invalid={!!errors.confirm} autoComplete="new-password" {...register("confirm")} />}</Field>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>Update password</Button>
      </form>
    </AuthCard>
  );
}
