"use client";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, buttonClass } from "./button";
import { CloseButton } from "./primitives";

/* ---------- Modal (native <dialog>: focus trap, Esc, inert background) ---------- */
export function Modal({ open, onClose, title, description, children, footer, side, width = "max-w-md" }: {
  open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode; side?: boolean; width?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label={title}
      className={cn("m-auto w-[calc(100%-2rem)] bg-transparent p-0 text-fg", side ? "ml-auto mr-0 h-dvh max-h-dvh w-full max-w-lg" : width)}>
      {open && (
        <div className={cn("flex flex-col border border-line bg-surface shadow-pop", side ? "slide-in h-dvh rounded-none" : "pop max-h-[85dvh] rounded-xl")}>
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div><h2 className="text-base font-semibold">{title}</h2>{description && <p className="mt-0.5 text-sm text-muted">{description}</p>}</div>
            <CloseButton onClick={onClose} />
          </div>
          <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
export const Drawer = (p: Omit<Parameters<typeof Modal>[0], "side">) => <Modal {...p} side />;

/* ---------- Toasts + confirm, one provider ---------- */
type Toast = { id: number; tone: "success" | "error" | "info"; text: string };
type ConfirmOpts = { title: string; description: string; confirmLabel?: string; danger?: boolean };
const Ctx = createContext<{ toast: (t: string, tone?: Toast["tone"]) => void; confirm: (o: ConfirmOpts) => Promise<boolean> } | null>(null);
export function useUI() { const c = useContext(Ctx); if (!c) throw new Error("UIProvider missing"); return c; }

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const toast = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null); };
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };
  const color = { success: "text-success", error: "text-danger", info: "text-brand" };
  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => { const I = Icon[t.tone]; return (
          <div key={t.id} className="pop pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-surface p-3 text-sm shadow-pop"><I size={18} className={cn("mt-0.5 shrink-0", color[t.tone])} />{t.text}</div>
        ); })}
      </div>
      <Modal open={!!dlg} onClose={() => close(false)} title={dlg?.title ?? ""} description={dlg?.description}
        footer={<><Button variant="outline" onClick={() => close(false)}>Cancel</Button><Button variant={dlg?.danger ? "danger" : "primary"} onClick={() => close(true)}>{dlg?.confirmLabel ?? "Confirm"}</Button></>} />
    </Ctx.Provider>
  );
}

/* ---------- Tabs (controlled, keyboard accessible) ---------- */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string; count?: number }>; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="scroll-thin flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          onKeyDown={(e) => { const i = tabs.findIndex((x) => x.id === value); if (e.key === "ArrowRight") onChange(tabs[(i + 1) % tabs.length].id); if (e.key === "ArrowLeft") onChange(tabs[(i - 1 + tabs.length) % tabs.length].id); }}
          className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors", value === t.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-fg")}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 rounded-full bg-surface2 px-1.5 py-0.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Dropdown menu ---------- */
export function Menu({ trigger, items, label = "Actions" }: { trigger?: ReactNode; label?: string; items: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean } | "sep"> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <button aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className={trigger ? "" : buttonClass("ghost", "icon")}>{trigger ?? "⋯"}</button>
      {open && (
        <div role="menu" className="pop absolute right-0 z-40 mt-1 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-pop">
          {items.map((it, i) => it === "sep" ? <hr key={i} className="my-1 border-line" /> : (
            <button key={it.label} role="menuitem" disabled={it.disabled} onClick={() => { setOpen(false); it.onClick(); }}
              className={cn("flex w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-surface2 disabled:opacity-40", it.danger && "text-danger")}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
