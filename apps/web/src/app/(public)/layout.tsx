"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo, ThemeToggle } from "@/components/layout/app-shell";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const links = [["How it works", "/how-it-works"], ["Pricing", "/pricing"], ["Data types", "/data-types"], ["Help", "/help"]] as const;

export default function PublicLayout({ children }: { children: ReactNode }) {
  const path = usePathname(); const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
          <Logo />
          <ul className="hidden gap-1 md:flex">{links.map(([l, h]) => <li key={h}><Link href={h} aria-current={path === h ? "page" : undefined} className={cn("rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface2", path === h ? "text-brand" : "text-muted hover:text-fg")}>{l}</Link></li>)}</ul>
          <div className="ml-auto flex items-center gap-2"><ThemeToggle />
            <Link href="/login" className={cn(buttonClass("ghost"), "hidden sm:inline-flex")}>Log in</Link>
            <Link href="/register" className={buttonClass("primary")}>Get started</Link>
            <button className="md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div>
        </nav>
        {open && <ul className="border-t border-line p-3 md:hidden">{[...links, ["Log in", "/login"] as const].map(([l, h]) => <li key={h}><Link onClick={() => setOpen(false)} href={h} className="block rounded-lg px-3 py-3 font-medium hover:bg-surface2">{l}</Link></li>)}</ul>}
      </header>
      <main id="main">{children}</main>
      <footer className="mt-24 border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div><Logo /><p className="mt-3 text-sm text-muted">Accountable data contribution, review and annotation.</p></div>
          <FooterCol title="Product" items={[["How it works", "/how-it-works"], ["Pricing", "/pricing"], ["Data types", "/data-types"]]} />
          <FooterCol title="Support" items={[["Help center", "/help"], ["Contact", "/help#contact"], ["Sign in", "/login"]]} />
          <FooterCol title="Legal" items={[["Terms of Service", "/legal/terms"], ["Privacy Policy", "/legal/privacy"], ["Contributor Agreement", "/legal/contributor-agreement"]]} />
        </div>
        <p className="border-t border-line px-6 py-5 text-center text-xs text-muted">© 2026 DataHub. Demo build: all figures are simulated.</p>
      </footer>
    </div>
  );
}
function FooterCol({ title, items }: { title: string; items: ReadonlyArray<readonly [string, string]> }) {
  return <div><p className="text-sm font-semibold">{title}</p><ul className="mt-3 space-y-2">{items.map(([l, h]) => <li key={h}><Link href={h} className="text-sm text-muted hover:text-fg">{l}</Link></li>)}</ul></div>;
}
