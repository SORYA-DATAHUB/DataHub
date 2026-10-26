import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Section({ children, className, id, tinted }: { children: ReactNode; className?: string; id?: string; tinted?: boolean }) {
  return (
    <section id={id} className={cn("scroll-mt-24", tinted && "border-y border-line bg-surface", className)}>
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">{children}</div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, description, center }: { eyebrow?: string; title: string; description?: string; center?: boolean }) {
  return (
    <div className={cn("mb-10 max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-brand">{eyebrow}</p>}
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {description && <p className="mt-3 text-base leading-7 text-muted">{description}</p>}
    </div>
  );
}

export function PageHero({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-brand">{eyebrow}</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">{description}</p>
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </div>
  );
}

export type FaqItem = { q: string; a: string };
/** Native disclosure elements: keyboard accessible, no JS required. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      {items.map((it) => (
        <details key={it.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium hover:bg-surface2 [&::-webkit-details-marker]:hidden">
            {it.q}
            <ChevronDown size={16} aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <p className="px-5 pb-5 text-sm leading-6 text-muted">{it.a}</p>
        </details>
      ))}
    </div>
  );
}

export const COMMON_FAQ: FaqItem[] = [
  { q: "Do I get paid as soon as I upload?", a: "No. Uploaded does not mean paid. Earnings are credited only after a reviewer accepts content that is unique and eligible, and withdrawals are approved manually by an administrator." },
  { q: "How is the accepted size measured?", a: "In decimal gigabytes (1 GB = 1,000,000,000 bytes) of the content that passes review. Rejected, duplicate and ineligible files are excluded." },
  { q: "What is the minimum withdrawal?", a: "The minimum withdrawal is $25.00 of available balance, and your identity verification must be complete." },
  { q: "Can I upload documents I do not own?", a: "Only if you are authorized to contribute them. You declare your rights during onboarding and again per dataset. Misdeclared content is removed and may lead to account action." },
  { q: "What is the difference between raw and labeled data?", a: "Raw data is accepted as-is. Labeled or clean data includes verified transcription, OCR correction or classification and earns a higher rate." }
];
