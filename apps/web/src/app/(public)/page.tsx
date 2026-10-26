import { ArrowRight, BadgeCheck, Banknote, CheckCircle2, ClipboardCheck, Database, FileCheck2, FileText, Image as ImageIcon, KeyRound, Languages, Lock, ScanLine, ShieldCheck, Upload, UserPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, Progress } from "@/components/ui/primitives";
import { COMMON_FAQ, Faq, Section, SectionHeading } from "@/features/marketing/sections";
import { CATEGORIES } from "@/mock/data";

const steps = [
  { icon: UserPlus, title: "Register", text: "Create an account, accept the agreement and declare your rights." },
  { icon: Upload, title: "Upload", text: "Send authorized files with resumable uploads and integrity checks." },
  { icon: ClipboardCheck, title: "Review", text: "Reviewers check quality, uniqueness and eligibility file by file." },
  { icon: Banknote, title: "Earn", text: "Accepted bytes are credited to your wallet at the published rate." },
  { icon: Wallet, title: "Withdraw", text: "Request a payout; an administrator approves and records it manually." }
];
const security = [
  { icon: Lock, title: "Private by default", text: "Files are encrypted and visible only to assigned reviewers and administrators." },
  { icon: KeyRound, title: "Role-based access", text: "Contributor, annotator, reviewer and admin permissions are separated and audited." },
  { icon: FileCheck2, title: "Transparent review", text: "See every decision, accepted byte count and reviewer comment." },
  { icon: Languages, title: "Khmer-ready", text: "Unicode text is preserved exactly through annotation and export." }
];
const categoryIcons = [FileText, FileText, ScanLine, ScanLine, ScanLine, ImageIcon, FileText, Database];

export default function Home() {
  return (
    <>
      <div className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-soft to-transparent" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
          <div>
            <Badge tone="brand">Data contribution, made accountable</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">Turn authorized documents into trusted datasets.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">Upload securely, receive detailed quality feedback, earn for accepted unique data, and complete professional annotation assignments.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/register" size="lg">Become a contributor <ArrowRight size={18} aria-hidden /></Button>
              <Button href="/how-it-works" size="lg" variant="outline">See how it works</Button>
            </div>
            <p className="mt-5 text-xs text-muted">Demo build. All figures and workflows are simulated.</p>
          </div>
          <Card className="p-5 shadow-pop" aria-label="Product preview">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted">DS-10482</p>
                <p className="font-semibold">Ministry gazette archive 1994–2003</p>
              </div>
              <Badge tone="success" dot>Approved</Badge>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[["Uploaded", "14.8 GB"], ["Accepted", "14.2 GB"], ["Quality", "94 / 100"]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-surface2 p-3"><p className="text-xs text-muted">{k}</p><p className="tabular mt-1 text-sm font-semibold">{v}</p></div>
              ))}
            </div>
            <div className="mt-5 space-y-1.5">
              <div className="flex justify-between text-xs text-muted"><span>Accepted share</span><span className="tabular">96%</span></div>
              <Progress value={96} tone="success" label="Accepted share" />
            </div>
            <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-success" aria-hidden /> 1,284 files processed, 0 duplicates</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-success" aria-hidden /> Estimated credit on review: 14.2 GB accepted</li>
              <li className="flex items-center gap-2 text-muted"><Wallet size={16} aria-hidden /> Withdrawal requires manual approval</li>
            </ul>
          </Card>
        </div>
      </div>

      <Section>
        <SectionHeading eyebrow="How it works" title="From upload to payout in five accountable steps" description="Every step is visible to you, with clear reasons whenever content is not accepted." />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Card className="h-full p-5">
                <div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon size={18} aria-hidden /></span><span className="tabular text-xs font-semibold text-muted">0{i + 1}</span></div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{text}</p>
              </Card>
            </li>
          ))}
        </ol>
        <div className="mt-6"><Button href="/how-it-works" variant="outline">Read the full process <ArrowRight size={16} aria-hidden /></Button></div>
      </Section>

      <Section tinted id="earn">
        <SectionHeading eyebrow="How contributors earn" title="You earn for what is accepted, not for what is uploaded" />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Accepted", "Content passes quality review and is added to the dataset."],
            ["Unique", "Duplicates of existing data or your own earlier uploads do not earn."],
            ["Eligible", "You must hold the rights to contribute it, and it must match a supported category."]
          ].map(([t, d]) => (
            <Card key={t} className="p-5"><BadgeCheck className="text-success" size={20} aria-hidden /><h3 className="mt-3 font-semibold">{t}</h3><p className="mt-1.5 text-sm leading-6 text-muted">{d}</p></Card>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-6 text-muted">Uploaded does not mean paid. Earnings are credited after review and withdrawals are approved manually by an administrator.</p>
      </Section>

      <Section id="pricing">
        <SectionHeading eyebrow="Pricing" title="Simple, published rates" description="1 GB = 1,000,000,000 bytes, measured on accepted content only." />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <Badge>Raw data</Badge>
            <p className="mt-4 text-4xl font-semibold tracking-tight"><span>$1.00</span> <span className="text-base font-normal text-muted">/ accepted GB</span></p>
            <p className="mt-2 text-sm text-muted">Authorized documents and files accepted as submitted.</p>
          </Card>
          <Card className="border-brand p-6 ring-1 ring-brand">
            <Badge tone="brand">Clean or labeled</Badge>
            <p className="mt-4 text-4xl font-semibold tracking-tight">$1.50 <span className="text-base font-normal text-muted">/ accepted GB</span></p>
            <p className="mt-2 text-sm text-muted">Includes verified transcription, OCR correction or classification.</p>
          </Card>
        </div>
        <div className="mt-6"><Button href="/pricing" variant="outline">Estimate your earnings</Button></div>
      </Section>

      <Section tinted>
        <SectionHeading eyebrow="Supported categories" title="Documents, images and structured data" />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c, i) => { const Icon = categoryIcons[i]; return (
            <li key={c} className="flex items-center gap-3 rounded-xl border border-line bg-bg p-4 text-sm font-medium"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon size={16} aria-hidden /></span>{c}</li>
          ); })}
        </ul>
        <div className="mt-6"><Button href="/data-types" variant="outline">Formats and limits</Button></div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Quality and security" title="Built for sensitive documents" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {security.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="p-5"><Icon className="text-brand" size={20} aria-hidden /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-1.5 text-sm leading-6 text-muted">{text}</p></Card>
          ))}
        </div>
      </Section>

      <Section tinted>
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" center />
          <Faq items={COMMON_FAQ} />
        </div>
      </Section>

      <Section>
        <div className="rounded-2xl bg-brand-soft px-6 py-12 text-center sm:px-12">
          <ShieldCheck className="mx-auto text-brand" size={28} aria-hidden />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Ready to contribute?</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted">Create a free account, complete onboarding and upload your first authorized dataset.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button href="/register" size="lg">Create free account</Button>
            <Button href="/help#contact" size="lg" variant="outline">Talk to support</Button>
          </div>
        </div>
      </Section>
    </>
  );
}
