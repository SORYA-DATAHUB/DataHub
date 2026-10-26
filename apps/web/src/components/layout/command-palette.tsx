"use client";
import { CornerDownLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { NAV, WORKSPACES, type Workspace } from "@/lib/nav";
import { Modal } from "@/components/ui/overlays";
import { Input } from "@/components/ui/primitives";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState(""); const [i, setI] = useState(0);
  const all = useMemo(() => (Object.keys(NAV) as Workspace[]).flatMap((w) => NAV[w].flatMap((g) => g.items.map((it) => ({ ...it, group: WORKSPACES[w].label })))), []);
  const results = all.filter((x, idx, arr) => arr.findIndex((y) => y.href === x.href) === idx && `${x.label} ${x.group}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  useEffect(() => { setI(0); }, [q]);
  useEffect(() => { if (open) setQ(""); }, [open]);
  const go = (href: string) => { onClose(); router.push(href); };
  return (
    <Modal open={open} onClose={onClose} title="Command palette" width="max-w-lg">
      <Input autoFocus aria-label="Search pages" placeholder="Type a page name…" value={q} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setI(Math.min(i + 1, results.length - 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setI(Math.max(i - 1, 0)); } if (e.key === "Enter" && results[i]) go(results[i].href); }} />
      <ul className="mt-3 space-y-0.5" role="listbox">
        {results.map((r, idx) => (
          <li key={r.href} role="option" aria-selected={idx === i}><button onClick={() => go(r.href)} onMouseEnter={() => setI(idx)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm", idx === i && "bg-brand-soft text-brand")}>
            <r.icon size={16} /><span className="flex-1">{r.label}</span><span className="text-xs text-muted">{r.group}</span>{idx === i && <CornerDownLeft size={12} />}</button></li>))}
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No matching pages</li>}
      </ul>
    </Modal>
  );
}
