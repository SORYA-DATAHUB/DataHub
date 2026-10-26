import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, ThemeToggle } from "@/components/layout/app-shell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-5"><Logo /><ThemeToggle /></header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center"><div className="w-full max-w-md">{children}</div></main>
      <footer className="flex justify-center gap-5 px-6 py-5 text-xs text-muted">
        <Link href="/legal/terms" className="hover:text-fg">Terms</Link><Link href="/legal/privacy" className="hover:text-fg">Privacy</Link><Link href="/help" className="hover:text-fg">Help</Link>
      </footer>
    </div>
  );
}
