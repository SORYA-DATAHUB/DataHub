"use client";
import { FileImage, ShieldCheck, ZoomIn } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { Drawer, useUI } from "@/components/ui/overlays";
import { Alert, Avatar, Field, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui/primitives";
import { KV, Loadable, SectionTitle, useQueryParam } from "./common";
import { ageDays, fmtDate, userById, type Verification } from "./data";
import { useVerifications } from "./state";

const REASONS = ["Document unreadable or blurry", "Name does not match account", "Document expired", "Selfie does not match document", "Unsupported document type"];

export function AdminVerifications() {
  const { list, decide } = useVerifications();
  const [caseId, setCase] = useQueryParam("case");
  const [status] = useQueryParam("status");
  const cur = list.find((v) => v.id === caseId);
  const rows = status ? list.filter((v) => v.status === status) : list;

  const cols: Column<Verification>[] = [
    { key: "user", header: "Applicant", sortValue: (v) => userById(v.userId)?.name ?? "", render: (v) => { const u = userById(v.userId); return <div className="flex items-center gap-3"><Avatar name={u?.name ?? "?"} size={28} /><div><p className="font-medium">{u?.name}</p><p className="text-xs text-muted">{u?.email}</p></div></div>; } },
    { key: "doc", header: "Document", render: (v) => v.docType },
    { key: "country", header: "Country", render: (v) => v.country, hideOnMobile: true },
    { key: "sub", header: "Submitted", sortValue: (v) => v.submitted, render: (v) => `${fmtDate(v.submitted)} (${ageDays(v.submitted)}d)` },
    { key: "st", header: "Status", sortValue: (v) => v.status, render: (v) => <StatusBadge status={v.status} /> },
    { key: "a", header: "", render: (v) => <Button size="sm" variant={v.status === "pending" ? "primary" : "outline"} onClick={(e) => { e.stopPropagation(); setCase(v.id); }}>{v.status === "pending" ? "Review" : "View"}</Button> }
  ];
  return (
    <Loadable>
      <PageHeader title="Verifications" description="Review identity documents before contributors become eligible for payment." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Verifications" }]} />
      <DataTable rows={rows} columns={cols} searchText={(v) => `${v.id} ${userById(v.userId)?.name} ${v.docType}`} onRowClick={(v) => setCase(v.id)}
        filters={[{ label: "Status", options: ["pending", "approved", "rejected"], predicate: (v, s) => v.status === s }]}
        empty={{ title: "Queue is clear", description: "No verification cases match." }} />
      <Drawer open={!!cur} onClose={() => setCase(null)} title={cur ? `Case ${cur.id}` : "Case"} description="Identity verification">
        {cur && <Case v={cur} onDecide={(s, text) => { decide(cur.id, s, text); }} />}
      </Drawer>
      {caseId && !cur && <span className="sr-only" role="alert">Case {caseId} not found</span>}
    </Loadable>
  );
}

function Case({ v, onDecide }: { v: Verification; onDecide: (s: "approved" | "rejected", text: string) => void }) {
  const { toast, confirm } = useUI();
  const u = userById(v.userId);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [zoom, setZoom] = useState(false);
  const approve = async () => {
    if (!(await confirm({ title: "Approve verification?", description: `${u?.name} will become eligible for payment on accepted data.`, confirmLabel: "Approve" }))) return;
    onDecide("approved", `Approved by Anna Keller${note ? `: ${note}` : ""}`); toast("Verification approved (demo).");
  };
  const reject = async () => {
    if (!reason) { setErr("Select a rejection reason."); return; }
    if (!(await confirm({ title: "Reject verification?", description: `The applicant will be told: ${reason}.`, confirmLabel: "Reject", danger: true }))) return;
    onDecide("rejected", `Rejected by Anna Keller: ${reason}${note ? ` (${note})` : ""}`); toast("Verification rejected (demo).", "info");
  };
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>ID document (placeholder)</SectionTitle>
        <button onClick={() => setZoom(!zoom)} aria-label="Toggle document zoom" className={`relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-surface2 text-muted ${zoom ? "h-80" : "h-44"}`}>
          <div className="text-center"><FileImage size={zoom ? 56 : 36} className="mx-auto" /><p className="mt-2 text-sm">{v.docType} · {v.country}</p><p className="text-xs">Demo placeholder. No real document is stored.</p></div>
          <ZoomIn size={16} className="absolute right-3 top-3" />
        </button>
      </div>
      <dl className="divide-y divide-line rounded-lg border border-line px-4">
        <KV k="Applicant" v={u?.name ?? "Unknown"} /><KV k="Email" v={u?.email} /><KV k="Document" v={v.docType} /><KV k="Country" v={v.country} /><KV k="Submitted" v={fmtDate(v.submitted)} /><KV k="Status" v={<StatusBadge status={v.status} />} />
      </dl>
      <div><SectionTitle>History</SectionTitle><ul className="space-y-2">{v.history.map((h, i) => <li key={i} className="text-sm"><span className="text-xs text-muted">{fmtDate(h.at)}</span><br />{h.text}</li>)}</ul></div>
      {v.status !== "pending" ? <Alert tone={v.status === "approved" ? "success" : "danger"} title={`Decision recorded: ${v.status}`}>This case is closed.</Alert> : (
        <div className="space-y-3 rounded-lg border border-line p-4">
          <SectionTitle>Decision</SectionTitle>
          <Field label="Rejection reason" hint="Required only when rejecting." error={err}>{(id, d) => <Select id={id} aria-describedby={d} aria-invalid={!!err} value={reason} onChange={(e) => { setReason(e.target.value); setErr(""); }}><option value="">Select a reason…</option>{REASONS.map((r) => <option key={r}>{r}</option>)}</Select>}</Field>
          <Field label="Internal note (optional)">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          <div className="flex gap-2"><Button onClick={approve}><ShieldCheck size={14} />Approve</Button><Button variant="danger" onClick={reject}>Reject</Button></div>
        </div>
      )}
    </div>
  );
}
