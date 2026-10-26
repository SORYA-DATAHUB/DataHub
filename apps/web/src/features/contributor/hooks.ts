"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { useUI } from "@/components/ui/overlays";
import { useDemoState, wait } from "@/lib/demo";
import { methodSeeds, myBase, notifSeeds, withdrawalSeeds, type CDataset, type Notif, type PayoutMethod, type Verification, type Withdrawal } from "./data";

const EMPTY_DS: CDataset[] = [];
const EMPTY_OV: Record<string, Partial<CDataset>> = {};

/** Reads/writes a single search param (used for ?tab=, ?filter=, ?file=). Default value is removed from the URL. */
export function useQueryParam(name: string, fallback: string) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const value = sp.get(name) ?? fallback;
  const set = useCallback((v: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (v === null || v === fallback) p.delete(name); else p.set(name, v);
    const qs = p.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }, [sp, router, path, name, fallback]);
  return [value, set] as const;
}

/** Contributor datasets: seeded mock + datasets created in the uploader + status patches (e.g. resubmit). */
export function useDatasets() {
  const [extra, setExtra] = useDemoState<CDataset[]>("contrib:datasets", EMPTY_DS);
  const [ov, setOv] = useDemoState<Record<string, Partial<CDataset>>>("contrib:ds-overrides", EMPTY_OV);
  const all = useMemo(() => [...extra, ...myBase].map((d) => ({ ...d, ...ov[d.id] })), [extra, ov]);
  const add = useCallback((d: CDataset) => setExtra((p) => [d, ...p.filter((x) => x.id !== d.id)]), [setExtra]);
  const patch = useCallback((id: string, p: Partial<CDataset>) => {
    setOv((o) => ({ ...o, [id]: { ...o[id], ...p } }));
    setExtra((x) => x.map((d) => (d.id === id ? { ...d, ...p } : d)));
  }, [setOv, setExtra]);
  return { datasets: all, add, patch };
}

const EMPTY_W: Withdrawal[] = [];
export function useWithdrawals() {
  const [extra, setExtra] = useDemoState<Withdrawal[]>("contrib:withdrawals", EMPTY_W);
  const list = useMemo(() => [...extra, ...withdrawalSeeds], [extra]);
  const add = useCallback((w: Withdrawal) => setExtra((p) => [w, ...p]), [setExtra]);
  return { withdrawals: list, add };
}

export function useVerification() { return useDemoState<Verification>("contrib:verification", "verified"); }
export function useNotifs() { return useDemoState<Notif[]>("contrib:notifs", notifSeeds); }
export function usePayoutMethods() { return useDemoState<PayoutMethod[]>("contrib:methods", methodSeeds); }

/** `?state=error` or `?state=empty` forces those states so QA can see them in demo mode. */
export function useForcedState() {
  const [state, setState] = useQueryParam("state", "");
  return { forced: state === "error" || state === "empty" ? state : "", clear: () => setState(null) };
}

/** Confirm + simulate resubmitting a dataset for review. */
export function useResubmit(patch: (id: string, p: Partial<CDataset>) => void) {
  const { confirm, toast } = useUI();
  return useCallback(async (d: CDataset) => {
    const ok = await confirm({ title: "Resubmit for review?", description: `${d.title} will return to the review queue. Files you have not fixed may be rejected again. Nothing is paid until reviewers approve it.`, confirmLabel: "Resubmit" });
    if (!ok) return false;
    await wait(600);
    patch(d.id, { status: "pending_review" });
    toast(`${d.id} resubmitted. It is now pending review.`);
    return true;
  }, [confirm, toast, patch]);
}
