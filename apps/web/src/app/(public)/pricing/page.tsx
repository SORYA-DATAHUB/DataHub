import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { EarningsCalculator } from "@/features/marketing/earnings-calculator";
import { COMMON_FAQ, Faq, PageHero, Section, SectionHeading } from "@/features/marketing/sections";

export const metadata: Metadata = { title: "Pricing" };

const requirements = ["You hold the rights to contribute the content", "Files open correctly and are in a supported format", "Content is unique (not already in DataHub)", "Quality meets the category guidelines", "No personal data that you are not authorized to share"];
const payment = [["Request", "Ask to withdraw once your available balance reaches $25."], ["Review", "An administrator checks your verification and balance."], ["Approval", "Payouts are approved manually; there is no automatic payment."], ["Paid", "The payment reference is recorded on your withdrawal."]];

export default function PricingPage() {
  return (
    <>
      <PageHero eyebrow="Pricing" title="Earn for every accepted gigabyte" description="Raw data earns $1.00 per accepted GB. Clean or labeled data earns $1.50 per accepted GB. Only content that passes review is counted." />
      <Section>
        <SectionHeading title="Estimate your earnings" description="Tell us how much you plan to upload and how much you expect to be accepted. This is an estimate, not a promise of payment." />
        <EarningsCalculator />
      </Section>
      <Section tinted>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">Eligibility requirements</h2>
            <ul className="mt-4 space-y-3 text-sm">{requirements.map((r) => <li key={r} className="flex gap-2.5"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />{r}</li>)}</ul>
            <h2 className="mt-10 text-xl font-semibold">Approval policy</h2>
            <p className="mt-3 text-sm leading-6 text-muted">Every dataset is reviewed by a person. Datasets may be approved, partially approved, returned for changes or rejected, and each decision carries reasons. Earnings are credited only for the accepted portion. 1 GB is 1,000,000,000 bytes.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Payment process</h2>
            <ol className="mt-4 space-y-3">{payment.map(([t, d], i) => <li key={t}><Card className="flex gap-4 p-4"><span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{i + 1}</span><div><p className="text-sm font-semibold">{t}</p><p className="text-sm text-muted">{d}</p></div></Card></li>)}</ol>
          </div>
        </div>
      </Section>
      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading title="Pricing FAQ" center />
          <Faq items={COMMON_FAQ} />
          <div className="mt-8 text-center"><Button href="/register" size="lg">Start contributing</Button></div>
        </div>
      </Section>
    </>
  );
}
