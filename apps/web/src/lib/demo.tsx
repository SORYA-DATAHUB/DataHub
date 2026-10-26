"use client";
import { useCallback, useEffect, useState } from "react";

/** useState persisted to localStorage so demo workflows survive navigation/reload. Safe when storage is unavailable. */
export function useDemoState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void, () => void] {
  const k = `datahub-demo:${key}`;
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try { const raw = localStorage.getItem(k); if (raw) setV(JSON.parse(raw)); } catch { /* storage unavailable */ }
  }, [k]);
  const set = useCallback((n: T | ((p: T) => T)) => {
    setV((p) => { const next = typeof n === "function" ? (n as (p: T) => T)(p) : n; try { localStorage.setItem(k, JSON.stringify(next)); } catch { /* ignore */ } return next; });
  }, [k]);
  const reset = useCallback(() => { try { localStorage.removeItem(k); } catch { /* ignore */ } setV(initial); }, [k, initial]);
  return [v, set, reset];
}

/** Simulates network latency so loading states are real in demo mode. */
export const wait = (ms = 700) => new Promise<void>((r) => setTimeout(r, ms));

/** Shows skeleton for `ms` on first mount. */
export function useFakeLoad(ms = 450) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), ms); return () => clearTimeout(t); }, [ms]);
  return loading;
}
