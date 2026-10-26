"use client";
import { Bell, Command, Database, Menu as MenuIcon, Moon, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { NAV, WORKSPACES, workspaceFor, type Workspace } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/primitives";
import { Menu, Modal } from "@/components/ui/overlays";
import { CommandPalette } from "./command-palette";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{m && resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</Button>;
}
export function Logo({ href = "/" }: { href?: string }) {
  return <Link href={href} className="flex items-center gap-2 font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white"><Database size={15} /></span>DataHub</Link>;
}

function SidebarNav({ ws, onNavigate }: { ws: Workspace; onNavigate?: () => void }) {
  const path = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));
  return (
    <nav aria-label="Workspace" className="space-y-5">
      {NAV[ws].map((g, i) => (
        <div key={i}>
          {g.title && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</p>}
          <ul className="space-y-0.5">{g.items.map((it) => (
            <li key={it.href}><Link href={it.href} onClick={onNavigate} aria-current={active(it.href, it.exact) ? "page" : undefined}
              className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active(it.href, it.exact) ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface2 hover:text-fg")}>
              <it.icon size={16} aria-hidden />{it.label}</Link></li>))}
          </ul>
        </div>))}
    </nav>
  );
}

export function WorkspaceSwitcher() {
  const path = usePathname(); const ws = workspaceFor(path);
  return (
    <div role="group" aria-label="Switch demo workspace" className="grid grid-cols-2 gap-1 rounded-lg bg-surface2 p-1">
      {(Object.keys(WORKSPACES) as Workspace[]).map((w) => (
        <Link key={w} href={WORKSPACES[w].home} aria-current={w === ws ? "true" : undefined}
          className={cn("rounded-md px-2 py-1 text-center text-xs font-medium", w === ws ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg")}>{WORKSPACES[w].label}</Link>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const ws = workspaceFor(path);
  const [mobile, setMobile] = useState(false);
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(true); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 overflow-y-auto border-r border-line bg-surface p-4 lg:flex scroll-thin">
        <Logo href={WORKSPACES[ws].home} /><WorkspaceSwitcher /><SidebarNav ws={ws} />
        <p className="mt-auto rounded-lg bg-warning-soft p-3 text-xs text-warning">Demo mode: all data is simulated. No real uploads or payments occur.</p>
      </aside>
      <Modal open={mobile} onClose={() => setMobile(false)} title="Navigation" side>
        <div className="space-y-5"><WorkspaceSwitcher /><SidebarNav ws={ws} onNavigate={() => setMobile(false)} /></div>
      </Modal>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-4 backdrop-blur lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobile(true)}><MenuIcon size={18} /></Button>
          <button onClick={() => setPalette(true)} className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-line bg-bg px-3 text-sm text-muted hover:border-muted/50 sm:max-w-sm">
            <Search size={14} /><span className="flex-1 text-left">Search or jump to…</span><kbd className="hidden items-center gap-0.5 rounded border border-line px-1.5 text-[11px] sm:flex"><Command size={10} />K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" aria-label="Notifications (3 unread)" href="/notifications" className="relative"><Bell size={16} /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" /></Button>
            <Menu label="Account menu" trigger={<span className="flex items-center gap-2 rounded-lg p-1 hover:bg-surface2"><Avatar name="Sokha Chan" size={28} /></span>}
              items={[{ label: "Profile", onClick: () => router.push("/profile") }, { label: "Settings", onClick: () => router.push("/settings") }, "sep", { label: "Sign out", onClick: () => router.push("/login") }]} />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1280px] px-4 py-6 lg:px-8">{children}</main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

/** Minimal focus layout: compact top bar, no sidebar (annotation editor, review workspace). */
export function FocusShell({ title, backHref, actions, children }: { title: ReactNode; backHref: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
        <Link href={backHref} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface2 hover:text-fg">← Exit</Link>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">{title}</div>
        <div className="flex items-center gap-1.5">{actions}<ThemeToggle /></div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
