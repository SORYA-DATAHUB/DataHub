"use client";
import { Info } from "lucide-react";
import { useId, useState } from "react";
import { Alert, Badge, Card, Field, Input } from "@/components/ui/primitives";
import { cn, gb, usd } from "@/lib/cn";
import { RATES } from "@/mock/data";

type Kind = "raw" | "labeled";

export function EarningsCalculator() {
  const [size, setSize] = useState("20");
  const [kind, setKind] = useState<Kind>("raw");
  const [pct, setPct] = useState(80);
  const sliderId = useId();
  const n = Number(size);
  const valid = size.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 50000;
  const accepted = valid ? (n * pct) / 100 : 0;
  const rate = RATES[kind];
  const total = accepted * rate;
  const meetsMin = total >= RATES.minWithdrawal;
  const error = size.trim() === "" ? "Enter a size in GB." : !Number.isFinite(n) || n < 0 ? "Enter a positive number." : n > 50000 ? "Maximum for the estimator is 50,000 GB." : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-6 p-6">
        <Field label="Total size you plan to upload (GB)" error={error} hint="1 GB = 1,000,000,000 bytes" required>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!error} inputMode="decimal" type="number" min={0} step="any" value={size} onChange={(e) => setSize(e.target.value)} />}
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Data type</legend>
          <div className="grid grid-cols-2 gap-3">
            {([["raw", "Raw data", RATES.raw], ["labeled", "Clean or labeled", RATES.labeled]] as const).map(([k, label, r]) => (
              <label key={k} className={cn("cursor-pointer rounded-lg border p-3 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand", kind === k ? "border-brand bg-brand-soft" : "border-line hover:bg-surface2")}>
                <input type="radio" name="kind" className="sr-only" checked={kind === k} onChange={() => setKind(k)} />
                <span className="block font-medium">{label}</span><span className="tabular text-xs text-muted">{usd(r)} / accepted GB</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <div className="mb-1.5 flex items-center justify-between"><label htmlFor={sliderId} className="text-sm font-medium">Expected accepted share</label><Badge tone="brand">{pct}%</Badge></div>
          <input id={sliderId} type="range" min={30} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-full accent-[var(--brand)]" aria-valuetext={`${pct} percent`} />
          <p className="mt-1 text-xs text-muted">Assumption only. Rejected, duplicate and ineligible files reduce this share. Your real share is decided by review.</p>
        </div>
      </Card>
      <Card className="flex flex-col p-6" aria-live="polite">
        <p className="text-sm text-muted">Estimated earnings if accepted as assumed</p>
        <p className="tabular mt-1 text-4xl font-semibold tracking-tight">{valid ? usd(total) : "—"}</p>
        <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
          <Row k="Planned upload" v={valid ? gb(n) : "—"} />
          <Row k={`Accepted at ${pct}%`} v={valid ? gb(accepted) : "—"} />
          <Row k="Rate" v={`${usd(rate)} / accepted GB`} />
          <Row k="Minimum withdrawal" v={usd(RATES.minWithdrawal)} />
        </dl>
        <div className="mt-6 space-y-3">
          {valid && <Alert tone={meetsMin ? "success" : "info"} title={meetsMin ? "Above the minimum withdrawal" : "Below the minimum withdrawal"}>{meetsMin ? "If accepted as assumed, you could request a payout once verified." : `You would need about ${gb(RATES.minWithdrawal / rate)} accepted to reach ${usd(RATES.minWithdrawal)}.`}</Alert>}
          <div className="flex gap-2 rounded-lg bg-warning-soft p-3 text-xs text-warning"><Info size={16} className="mt-0.5 shrink-0" aria-hidden /><p><strong>Uploaded does not guarantee payment.</strong> Only accepted, unique, eligible content earns, and payouts need manual administrator approval.</p></div>
        </div>
      </Card>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="tabular font-medium">{v}</dd></div>;
}
