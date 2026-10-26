import Link from "next/link";
import { PageHero } from "./sections";
import { cn } from "@/lib/cn";

export type LegalSection = { id: string; title: string; body: string[] };
export const LEGAL_PAGES = [
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/contributor-agreement", label: "Contributor Agreement" },
  { href: "/legal/data-ownership", label: "Data Ownership and Licensing" }
] as const;

export function LegalDoc({ title, updated, intro, sections, current }: { title: string; updated: string; intro: string; sections: LegalSection[]; current: string }) {
  return (
    <>
      <PageHero eyebrow={`Legal · Last updated ${updated}`} title={title} description={intro} />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="Legal documents" className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Documents</p>
            <ul className="space-y-0.5">{LEGAL_PAGES.map((p) => <li key={p.href}><Link href={p.href} aria-current={p.href === current ? "page" : undefined} className={cn("block rounded-lg px-3 py-1.5 text-sm", p.href === current ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-surface2 hover:text-fg")}>{p.label}</Link></li>)}</ul>
          </nav>
          <nav aria-label="On this page">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">On this page</p>
            <ol className="space-y-0.5 border-l border-line">{sections.map((s, i) => <li key={s.id}><a href={`#${s.id}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-sm text-muted hover:border-brand hover:text-fg"><span className="tabular mr-1.5">{i + 1}.</span>{s.title}</a></li>)}</ol>
          </nav>
        </aside>
        <article className="min-w-0 max-w-3xl">
          <p className="mb-8 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">Demo content. This text illustrates the product and is not a binding legal document.</p>
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 border-b border-line py-8 first:pt-0 last:border-0">
              <h2 className="text-xl font-semibold tracking-tight"><span className="tabular mr-2 text-muted">{i + 1}.</span>{s.title}</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-muted">{s.body.map((p) => <p key={p}>{p}</p>)}</div>
            </section>
          ))}
        </article>
      </div>
    </>
  );
}
