import { Banknote, ClipboardCheck, CheckCircle2, Upload, UserPlus, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/primitives";
import { PageHero, Section } from "@/features/marketing/sections";

export const metadata: Metadata = { title: "How it works" };

const steps = [
  { icon: UserPlus, title: "Register", time: "2 min", text: "Create your account, verify your email, accept the Contributor Agreement and declare that you hold the rights to what you upload.", points: ["Email verification", "Rights declaration", "Optional identity verification (required before withdrawing)"] },
  { icon: Upload, title: "Upload", time: "Depends on size", text: "Add a title, category and language, then upload files. Uploads are resumable and every file is integrity-checked.", points: ["Up to 50 GB per dataset", "Automatic duplicate detection", "Pause and resume at any time"] },
  { icon: ClipboardCheck, title: "Review", time: "1 to 5 business days", text: "A reviewer inspects quality, uniqueness and eligibility. You can see the status and comments of every decision.", points: ["Accepted, rejected or changes requested", "Per-file reasons", "Re-submit corrected files"] },
  { icon: CheckCircle2, title: "Approval", time: "On review completion", text: "Datasets are approved fully or partially. Only accepted bytes count towards earnings.", points: ["Accepted size shown in GB", "Duplicates excluded", "Appeal path through Support"] },
  { icon: Banknote, title: "Earnings", time: "Credited on approval", text: "Accepted gigabytes are converted to wallet balance: $1.00 per GB for raw data and $1.50 per GB for labeled data.", points: ["Pending, available and paid balances", "Full ledger history", "No earnings for unaccepted content"] },
  { icon: Wallet, title: "Withdrawal", time: "Manual approval", text: "Request a payout of $25 or more once verified. An administrator reviews, approves and records the payment manually.", points: ["Bank transfer or Wing", "Status tracking", "Payment reference recorded"] }
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero eyebrow="How it works" title="A transparent path from upload to payout" description="Six steps, each with a visible status. You always know what is happening to your data and why.">
        <Button href="/register" size="lg">Create account</Button>
        <Button href="/pricing" size="lg" variant="outline">See pricing</Button>
      </PageHero>
      <Section>
        <ol className="relative mx-auto max-w-3xl space-y-6 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-px before:bg-line">
          {steps.map(({ icon: Icon, title, time, text, points }, i) => (
            <li key={title} className="relative flex gap-5">
              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-brand shadow-card"><Icon size={18} aria-hidden /></span>
              <Card className="min-w-0 flex-1 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold"><span className="tabular mr-2 text-muted">{i + 1}.</span>{title}</h2><span className="text-xs text-muted">{time}</span></div>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
                <ul className="mt-3 space-y-1.5 text-sm">{points.map((p) => <li key={p} className="flex items-start gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" aria-hidden />{p}</li>)}</ul>
              </Card>
            </li>
          ))}
        </ol>
        <div className="mx-auto mt-10 max-w-3xl"><Alert tone="warning" title="Uploaded does not mean paid">Only accepted, unique and eligible content earns. Withdrawals always require manual administrator approval.</Alert></div>
      </Section>
    </>
  );
}
