"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import { Card, DeniedState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useFakeLoad } from "@/lib/demo";

/** Reads/writes a single URL query param (shallow replace, no scroll). */
export function useQueryParam(key: string, fallback = ""): [string, (v: string | null) => void] {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const value = sp.get(key) ?? fallback;
  const set = useCallback((v: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (v === null || v === "") p.delete(key); else p.set(key, v);
    const qs = p.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }, [sp, router, path, key]);
  return [value, set];
}

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <Card className="space-y-3 p-4">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10" />)}</Card>
    </div>
  );
}

/** Shows a skeleton briefly on first mount, then children. `?state=error|denied` previews those states. */
export function Loadable({ children, ms = 450, role = "Administrator" }: { children: ReactNode; ms?: number; role?: string }) {
  const loading = useFakeLoad(ms);
  const [state, setState] = useQueryParam("state");
  if (loading) return <PageSkeleton />;
  if (state === "error") return <Card><ErrorState onRetry={() => setState(null)} /></Card>;
  if (state === "denied") return <Card><DeniedState role={role} /></Card>;
  return <>{children}</>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{children}</h3>;
}
export function KV({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex items-start justify-between gap-4 py-1.5 text-sm"><dt className="text-muted">{k}</dt><dd className="min-w-0 text-right font-medium">{v}</dd></div>;
}

/** Sets several query params atomically. */
export function useSetQuery() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  return useCallback((vals: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    Object.entries(vals).forEach(([k, v]) => { if (v === null || v === "") p.delete(k); else p.set(k, v); });
    const qs = p.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }, [sp, router, path]);
}
