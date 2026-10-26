"use client";
import { ShieldAlert, UserCog } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal, useUI } from "@/components/ui/overlays";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { usd } from "@/lib/cn";
import { ACTORS, allowed, roleLabel, violatesSoD, useActor, usePayouts, type PayoutAction, type PayoutRec } from "./store";

export function ActorSwitch() {
  const { actor, setActorName } = useActor();
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-3 py-1.5 text-xs">
      <UserCog size={14} className="text-muted" aria-hidden />
      <label htmlFor="demo-actor" className="whitespace-nowrap text-muted">Demo: acting as</label>
      <Select id="demo-actor" className="h-7 w-auto py-0 text-xs" value={actor.name} onChange={(e) => setActorName(e.target.value)}>
        {ACTORS.map((a) => <option key={a.name} value={a.name}>{a.name} ({roleLabel(a.role)})</option>)}
      </Select>
    </div>
  );
}

export const ACTION_LABEL: Record<PayoutAction, string> = {
  review: "Start review", approve: "Approve", reject: "Reject", processing: "Mark processing",
  record: "Record external payment", failed: "Mark failed", proof: "Upload proof", reopen: "Reopen for review"
};

type Dlg = null | { kind: "reject" | "failed" | "record"; p: PayoutRec };

/** Central workflow controller: confirmations, reason/reference dialogs, separation-of-duties checks, simulated proof upload. */
export function usePayoutFlow() {
  const { list, apply } = usePayouts();
  const { actor } = useActor();
  const { toast, confirm } = useUI();
  const [dlg, setDlg] = useState<Dlg>(null);
  const [text, setText] = useState("");
  const [ref, setRef] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const proofFor = useRef<string | null>(null);

  const blockedReason = (p: PayoutRec, a: PayoutAction): string | null => {
    if (!allowed(p, a)) return "Not available in the current status";
    if (a === "record" && violatesSoD(p, actor)) return "Separation of duties: the approver cannot record this payment";
    return null;
  };

  const run = async (id: string, a: PayoutAction) => {
    const p = list.find((x) => x.id === id); if (!p) return;
    const why = blockedReason(p, a);
    if (why) { toast(why, "error"); return; }
    setText(""); setRef(""); setErr("");
    if (a === "reject" || a === "failed" || a === "record") { setDlg({ kind: a, p }); return; }
    if (a === "proof") { proofFor.current = id; fileRef.current?.click(); return; }
    const copy: Record<string, [string, string]> = {
      review: ["Start review?", `Moves ${p.id} (${usd(p.amount)}) to Under review and assigns you as reviewer.`],
      approve: ["Approve payout?", `Approving ${p.id} authorises a manual external payment of ${usd(p.amount)} to ${p.user}. You will not be able to record this payment yourself.`],
      processing: ["Mark as processing?", `Confirms the external transfer for ${p.id} has been initiated manually. DataHub does not move money.`],
      reopen: ["Reopen for review?", `Returns ${p.id} to Under review so it can be re-approved or rejected.`]
    };
    const [title, description] = copy[a];
    if (await confirm({ title, description, confirmLabel: ACTION_LABEL[a] })) {
      apply(id, actor, a);
      toast(`${p.id}: ${ACTION_LABEL[a].toLowerCase()} done`);
    }
  };

  const submit = async () => {
    if (!dlg) return;
    const { kind, p } = dlg;
    if (kind === "record") {
      if (ref.trim().length < 4) { setErr("Enter the external payment reference (at least 4 characters)."); return; }
      if (violatesSoD(p, actor)) { setErr("Separation of duties: you approved this payout, so another administrator must record the payment."); return; }
    } else if (text.trim().length < 5) { setErr("Please provide a reason (at least 5 characters)."); return; }
    const copy = kind === "record"
      ? { title: "Record external payment?", description: `Records that ${usd(p.amount)} was paid to ${p.user} outside DataHub, reference ${ref.trim()}. This is a ledger entry and cannot be edited.`, confirmLabel: "Record payment", danger: false }
      : kind === "reject"
        ? { title: "Reject payout?", description: `${p.id} will be rejected and ${usd(p.amount)} returned to ${p.user}'s available balance. The contributor will see your reason.`, confirmLabel: "Reject payout", danger: true }
        : { title: "Mark payment failed?", description: `${p.id} will be marked failed and the reserve released back to ${p.user}.`, confirmLabel: "Mark failed", danger: true };
    setDlg(null);
    if (await confirm(copy)) {
      apply(p.id, actor, kind, { note: text.trim(), reference: ref.trim() });
      toast(kind === "record" ? `${p.id}: external payment recorded` : `${p.id}: ${kind === "reject" ? "rejected" : "marked failed"}`);
    }
  };

  const dialogs: ReactNode = (
    <>
      <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" tabIndex={-1} aria-label="Proof of payment file"
        onChange={(e) => {
          const f = e.target.files?.[0]; const id = proofFor.current;
          if (f && id) { apply(id, actor, "proof", { file: f.name }); toast(`Proof "${f.name}" attached to ${id} (simulated upload)`); }
          e.target.value = "";
        }} />
      <Modal open={!!dlg} onClose={() => setDlg(null)}
        title={dlg?.kind === "record" ? "Record external payment" : dlg?.kind === "reject" ? "Reject payout" : "Mark payment failed"}
        description={dlg ? `${dlg.p.id} · ${dlg.p.user} · ${usd(dlg.p.amount)} via ${dlg.p.method}` : undefined}
        footer={<><Button variant="outline" onClick={() => setDlg(null)}>Cancel</Button><Button variant={dlg?.kind === "record" ? "primary" : "danger"} onClick={submit}>Continue</Button></>}>
        {dlg && (
          <div className="space-y-4">
            {dlg.kind === "record" && (<>
              <Alert tone="info" title="Payments are made outside DataHub">Pay the contributor manually (bank, Wing, PayPal), then record the transaction reference here. Nothing is transferred by this action.</Alert>
              {violatesSoD(dlg.p, actor) && <Alert tone="danger" title="Separation of duties"><span className="inline-flex items-center gap-1"><ShieldAlert size={14} aria-hidden />You approved this payout ({dlg.p.approvedBy}). Switch to a different administrator to record it.</span></Alert>}
              <Field label="External payment reference" required error={err} hint="Bank or wallet transaction ID">{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!err} value={ref} onChange={(e) => { setRef(e.target.value); setErr(""); }} placeholder="e.g. ABA-20261026-0041" />}</Field>
            </>)}
            {dlg.kind !== "record" && <Field label="Reason" required error={err} hint="Shown in the audit trail and to the contributor.">{(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!err} value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} />}</Field>}
          </div>
        )}
      </Modal>
    </>
  );
  return { list, actor, run, blockedReason, dialogs };
}
