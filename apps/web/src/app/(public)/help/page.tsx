import { BookOpen, Mail, ShieldQuestion, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { COMMON_FAQ, Faq, PageHero, Section, SectionHeading } from "@/features/marketing/sections";
import { SupportForm } from "@/features/marketing/support-form";

export const metadata: Metadata = { title: "Help" };

const resources = [
  { icon: BookOpen, title: "How it works", text: "The full path from upload to payout.", href: "/how-it-works" },
  { icon: Wallet, title: "Pricing and payouts", text: "Rates, minimums and the approval process.", href: "/pricing" },
  { icon: ShieldQuestion, title: "Data ownership", text: "What rights you need to contribute.", href: "/legal/data-ownership" },
  { icon: Mail, title: "Contributor agreement", text: "Your obligations and ours.", href: "/legal/contributor-agreement" }
];

export default function HelpPage() {
  return (
    <>
      <PageHero eyebrow="Help center" title="How can we help?" description="Browse the guides, check the FAQ, or send us a message. We reply within two business days." />
      <Section>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {resources.map(({ icon: Icon, title, text, href }) => (
            <li key={title}><Link href={href} className="block h-full rounded-xl focus-visible:outline-offset-4"><Card className="h-full p-5 transition-colors hover:border-brand"><Icon className="text-brand" size={20} aria-hidden /><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-1 text-sm text-muted">{text}</p></Card></Link></li>
          ))}
        </ul>
      </Section>
      <Section tinted>
        <div className="mx-auto max-w-3xl"><SectionHeading title="Frequently asked questions" center /><Faq items={COMMON_FAQ} /></div>
      </Section>
      <Section id="contact">
        <div className="mx-auto max-w-2xl">
          <SectionHeading title="Contact support" description="Describe the problem and include any dataset ID. Demo build: messages are not actually sent." />
          <SupportForm />
        </div>
      </Section>
    </>
  );
}
