"use client";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, FileText, Info, Minus, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FocusShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Modal, useUI } from "@/components/ui/overlays";
import { Alert, Avatar, Badge, Field, Select, StatusBadge, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useDemoState } from "@/lib/demo";
import { datasetById, KHMER_SAMPLE } from "@/mock/data";
import { SectionTitle, useQueryParam, useSetQuery } from "./common";
import { filesFor, fmtDate, gb, rateFor, reviewById, usd, userById, type MockFile, type Review } from "./data";
import { useDatasets } from "./state";

type Decision = "pending" | "accepted" | "rejected";
type Kind = "approve" | "partial" | "reject" | "changes" | "feedback";
type HistoryItem = { at: string; actor: string; text: string };
type RState = { decisions: Record<string, Decision>; checklist: Record<string, boolean>; notes: string; history: HistoryItem[]; outcome: string | null };

const CHECKLIST = ["Files open and are readable", "Language matches the declared metadata", "No unredacted personal or sensitive data", "No duplicate or stock content", "Contributor has the right to share this data", "Labels / sidecar text are usable (labeled datasets)"];
const REJECT_REASONS = ["Duplicate content", "Unreadable or corrupted files", "Contains personal data", "Copyright or licensing concern", "Does not match declared category", "Quality below threshold"];
const OUTCOME_STATUS = { approve: "approved", partial: "partially_approved", reject: "rejected", changes: "changes_requested" } as const;
const OUTCOME_LABEL = { approve: "Approved", partial: "Partially approved", reject: "Rejected", changes: "Changes requested", feedback: "Feedback sent" } as const;

function initial(r: Review, files: MockFile[]): RState {
  const decisions: Record<string, Decision> = {};
  files.forEach((f) => {
    decisions[f.id] = r.status !== "completed" ? "pending" : r.outcome === "Rejected" ? "rejected" : r.outcome === "Approved" ? (f.status === "duplicate" ? "rejected" : "accepted") : f.status === "clean" ? "accepted" : "rejected";
  });
  const history: HistoryItem[] = [{ at: `${fmtDate(r.submitted)}`, actor: "System", text: "Dataset submitted for review" }];
  if (r.claimedBy) history.unshift({ at: fmtDate(r.submitted), actor: r.claimedBy, text: "Claimed the review" });
  if (r.outcome) history.unshift({ at: fmtDate(r.submitted), actor: r.claimedBy ?? "Reviewer", text: `Decision: ${r.outcome}` });
  return { decisions, checklist: r.status === "completed" ? Object.fromEntries(CHECKLIST.map((c) => [c, true])) : {}, notes: "", history, outcome: r.outcome ?? null };
}

export function ReviewWorkspace({ reviewId }: { reviewId: string }) {
  const review = reviewById(reviewId)!;
  const ds = datasetById(review.datasetId)!;
  const files = useMemo(() => filesFor(ds), [ds]);
  const { toast } = useUI();
  const { patch } = useDatasets();
  const [st, setSt] = useDemoState<RState>(`review-${reviewId}`, initial(review, files));
  const [claims, setClaims] = useDemoState<Record<string, string>>("admin-review-claims", {});
  const claimedBy = review.claimedBy ?? claims[reviewId] ?? null;
  const mine = claimedBy === "Anna Keller";
  const done = !!st.outcome;
  const locked = done || !mine;
  const outcomeKey = (Object.keys(OUTCOME_STATUS) as Array<keyof typeof OUTCOME_STATUS>).find((k) => OUTCOME_LABEL[k] === st.outcome);
  const outcomeStatus = outcomeKey ? OUTCOME_STATUS[outcomeKey] : claimedBy ? "in_review" : "pending_review";

  const [fileId] = useQueryParam("file");
  const [pageRaw] = useQueryParam("page", "1");
  const setQuery = useSetQuery();
  const cur = files.find((f) => f.id === fileId) ?? files[0];
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), cur.pages);
  const [zoom, setZoom] = useState(100);
  const [panel, setPanel] = useState<"files" | "preview" | "review">("preview");
  const [filter, setFilter] = useState<"all" | Decision>("all");
  const [dlg, setDlg] = useState<Kind | null>(null);

  const dec = (id: string) => st.decisions[id] ?? "pending";
  const sum = (d: Decision) => files.filter((f) => dec(f.id) === d).reduce((a, f) => a + f.sizeGb, 0);
  const acc = sum("accepted"), rej = sum("rejected"), pend = sum("pending");
  const rate = rateFor(ds.kind);
  const counts = { accepted: files.filter((f) => dec(f.id) === "accepted").length, rejected: files.filter((f) => dec(f.id) === "rejected").length, pending: files.filter((f) => dec(f.id) === "pending").length };
  const checkDone = CHECKLIST.filter((c) => st.checklist[c]).length;
  const owner = userById(ds.ownerId);

  const log = (text: string, extra?: Partial<RState>) => setSt((s) => ({ ...s, ...extra, history: [{ at: "Today", actor: "Anna Keller", text }, ...s.history] }));
  const setDecision = (f: MockFile, d: Decision) => {
    if (locked) return;
    if (d === "accepted" && f.status === "duplicate") { toast("Duplicate files are not eligible and cannot be accepted.", "error"); return; }
    if (d === "accepted" && f.status === "scan_flagged") { toast("Files flagged by the malware scan cannot be accepted. Rescan first.", "error"); return; }
    setSt((s) => ({ ...s, decisions: { ...s.decisions, [f.id]: d } }));
  };
  const bulk = (mode: "clean" | "flagged") => {
    if (locked) return;
    setSt((s) => ({ ...s, decisions: { ...s.decisions, ...Object.fromEntries(files.filter((f) => (mode === "clean" ? f.status === "clean" : f.status !== "clean")).map((f) => [f.id, mode === "clean" ? "accepted" : "rejected"])) } }));
    toast(mode === "clean" ? "All clean files accepted." : "All flagged files rejected.");
  };
  const selectFile = (id: string) => { setQuery({ file: id, page: "1" }); setPanel("preview"); };

  const blockers: Record<Kind, string> = {
    approve: counts.pending > 0 ? "Decide every file first" : counts.rejected > 0 ? "Rejected files exist: use Partially approve" : checkDone < CHECKLIST.length ? "Complete the quality checklist" : "",
    partial: counts.pending > 0 ? "Decide every file first" : counts.accepted === 0 || counts.rejected === 0 ? "Needs both accepted and rejected files" : "",
    reject: "", changes: "", feedback: ""
  };

  const submit = (kind: Kind, message: string, reason: string) => {
    if (kind === "feedback") { log(`Sent feedback to contributor: "${message}"`); toast("Feedback sent to contributor (simulated)."); setDlg(null); return; }
    let accepted = acc;
    if (kind === "reject") { setSt((s) => ({ ...s, decisions: Object.fromEntries(files.map((f) => [f.id, "rejected" as Decision])) })); accepted = 0; }
    if (kind === "changes") accepted = 0;
    const earn = kind === "changes" ? 0 : accepted * rate;
    const text = `${OUTCOME_LABEL[kind]}${kind === "approve" || kind === "partial" ? `: ${gb(accepted)} accepted, est. ${usd(earn)}` : ""}${reason ? `. Reason: ${reason}` : ""}${message ? `. "${message}"` : ""}`;
    log(text, { outcome: OUTCOME_LABEL[kind] });
    patch(ds.id, { status: OUTCOME_STATUS[kind] });
    toast(`${OUTCOME_LABEL[kind]} (demo). ${earn > 0 ? `Estimated earning ${usd(earn)} is subject to manual payout approval.` : ""}`);
    setDlg(null);
  };
  const reopen = () => { log("Reopened the review"); setSt((s) => ({ ...s, outcome: null })); patch(ds.id, { status: "pending_review" }); toast("Review reopened.", "info"); };

  const shown = files.filter((f) => filter === "all" || dec(f.id) === filter);
  const tabBtn = (id: typeof panel, label: string) => (
    <button key={id} role="tab" aria-selected={panel === id} onClick={() => setPanel(id)} className={cn("flex-1 border-b-2 py-2.5 text-sm font-medium", panel === id ? "border-brand text-brand" : "border-transparent text-muted")}>{label}</button>
  );

  return (
    <FocusShell backHref="/admin/reviews" title={<span>Review {reviewId} <span className="text-muted">· {ds.title}</span></span>}
      actions={<span className="hidden sm:block"><StatusBadge status={outcomeStatus} /></span>}>
      <div className="flex h-full flex-col">
        <div role="tablist" aria-label="Workspace panels" className="flex shrink-0 border-b border-line bg-surface lg:hidden">{tabBtn("files", `Files (${files.length})`)}{tabBtn("preview", "Preview")}{tabBtn("review", "Review")}</div>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[288px_minmax(0,1fr)_380px]">
          {/* LEFT */}
          <section aria-label="Files" className={cn("min-h-0 flex-col border-r border-line bg-surface", panel === "files" ? "flex" : "hidden", "lg:flex")}>
            <div className="space-y-2 border-b border-line p-3">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Files</h2><span className="text-xs text-muted">{counts.accepted} ok · {counts.rejected} rej · {counts.pending} left</span></div>
              <Select aria-label="Filter files" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">All files</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option></Select>
              <div className="flex gap-2"><Button size="sm" variant="outline" disabled={locked} onClick={() => bulk("clean")}>Accept clean</Button><Button size="sm" variant="outline" disabled={locked} onClick={() => bulk("flagged")}>Reject flagged</Button></div>
            </div>
            <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto">
              {shown.length === 0 && <li className="p-6 text-center text-sm text-muted">No files in this filter.</li>}
              {shown.map((f) => (
                <li key={f.id} className={cn("flex items-center gap-2 border-b border-line px-3 py-2", cur.id === f.id && "bg-brand-soft")}>
                  <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => selectFile(f.id)} aria-current={cur.id === f.id}>
                    <FileText size={16} className="shrink-0 text-muted" />
                    <span className="min-w-0"><span className="block truncate font-mono text-xs font-medium">{f.name}</span><span className="block text-[11px] text-muted">{gb(f.sizeGb)} · {f.pages}p{f.status !== "clean" && <span className="text-warning"> · {f.status.replace("_", " ")}</span>}</span></span>
                  </button>
                  <span className="flex shrink-0 gap-1">
                    <button aria-label={`Accept ${f.name}`} aria-pressed={dec(f.id) === "accepted"} disabled={locked} onClick={() => setDecision(f, dec(f.id) === "accepted" ? "pending" : "accepted")} className={cn("flex h-6 w-6 items-center justify-center rounded-md border border-line disabled:opacity-40", dec(f.id) === "accepted" ? "border-success bg-success-soft text-success" : "text-muted hover:bg-surface2")}><Check size={13} /></button>
                    <button aria-label={`Reject ${f.name}`} aria-pressed={dec(f.id) === "rejected"} disabled={locked} onClick={() => setDecision(f, dec(f.id) === "rejected" ? "pending" : "rejected")} className={cn("flex h-6 w-6 items-center justify-center rounded-md border border-line disabled:opacity-40", dec(f.id) === "rejected" ? "border-danger bg-danger-soft text-danger" : "text-muted hover:bg-surface2")}><X size={13} /></button>
                  </span>
                </li>))}
            </ul>
          </section>

          {/* CENTER */}
          <section aria-label="Document preview" className={cn("min-h-0 min-w-0 flex-col bg-bg", panel === "preview" ? "flex" : "hidden", "lg:flex")}>
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
              <div className="min-w-0 flex-1"><p className="truncate font-mono text-xs font-medium">{cur.name}</p><p className="text-[11px] text-muted">{cur.type} · {gb(cur.sizeGb)} · {cur.pages} pages</p></div>
              <div className="flex items-center gap-1" role="group" aria-label="Page navigation">
                <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Previous page" disabled={page <= 1} onClick={() => setQuery({ page: String(page - 1) })}><ChevronLeft size={14} /></Button>
                <span className="tabular w-16 text-center text-xs">{page} / {cur.pages}</span>
                <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Next page" disabled={page >= cur.pages} onClick={() => setQuery({ page: String(page + 1) })}><ChevronRight size={14} /></Button>
              </div>
              <div className="flex items-center gap-1" role="group" aria-label="Zoom">
                <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Zoom out" disabled={zoom <= 60} onClick={() => setZoom(zoom - 20)}><Minus size={14} /></Button>
                <button className="tabular w-12 text-center text-xs hover:text-brand" aria-label="Reset zoom" onClick={() => setZoom(100)}>{zoom}%</button>
                <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Zoom in" disabled={zoom >= 180} onClick={() => setZoom(zoom + 20)}><Plus size={14} /></Button>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant={dec(cur.id) === "accepted" ? "primary" : "outline"} disabled={locked} onClick={() => setDecision(cur, dec(cur.id) === "accepted" ? "pending" : "accepted")}><Check size={14} />Accept file</Button>
                <Button size="sm" variant={dec(cur.id) === "rejected" ? "danger" : "outline"} disabled={locked} onClick={() => setDecision(cur, dec(cur.id) === "rejected" ? "pending" : "rejected")}><X size={14} />Reject file</Button>
              </div>
            </div>
            {cur.note && <div className="px-3 pt-3"><Alert tone="warning" title={cur.status.replace("_", " ")}>{cur.note}</Alert></div>}
            <div className="scroll-thin min-h-0 flex-1 overflow-auto p-4">
              <Paper file={cur} page={page} zoom={zoom} decision={dec(cur.id)} />
            </div>
          </section>

          {/* RIGHT */}
          <section aria-label="Review details" className={cn("scroll-thin min-h-0 flex-col overflow-y-auto border-l border-line bg-surface", panel === "review" ? "flex" : "hidden", "lg:flex")}>
            <div className="space-y-5 p-4">
              {!claimedBy && <Alert tone="info" title="Unclaimed review" action={<Button size="sm" onClick={() => { setClaims((c) => ({ ...c, [reviewId]: "Anna Keller" })); log("Claimed the review"); toast("Review claimed."); }}>Claim</Button>}>Claim it to make decisions.</Alert>}
              {claimedBy && !mine && !done && <Alert tone="warning" title={`Claimed by ${claimedBy}`} action={<Button size="sm" variant="outline" onClick={() => { setClaims((c) => ({ ...c, [reviewId]: "Anna Keller" })); log(`Took over the review from ${claimedBy}`); toast("You took over this review."); }}>Take over</Button>}>Read-only until you take over.</Alert>}
              {done && <Alert tone={st.outcome === "Approved" ? "success" : st.outcome === "Rejected" ? "danger" : "info"} title={`Decision: ${st.outcome}`} action={<Button size="sm" variant="outline" onClick={reopen}>Reopen</Button>}>Decisions are locked.</Alert>}

              <div><SectionTitle>Contributor</SectionTitle>
                <div className="flex items-center gap-3 rounded-lg border border-line p-3"><Avatar name={ds.owner} size={36} />
                  <div className="min-w-0 flex-1"><Link href={`/admin/users/${ds.ownerId}`} className="block truncate text-sm font-medium hover:text-brand">{ds.owner}</Link><p className="truncate text-xs text-muted">{owner?.email} · {owner?.uploads} uploads · {gb(owner?.acceptedGb ?? 0)} accepted</p></div>
                  {owner && <StatusBadge status={owner.verification} />}</div></div>

              <div><SectionTitle>Dataset</SectionTitle>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  {[["ID", ds.id], ["Category", ds.category], ["Language", ds.language], ["Type", `${ds.kind} · $${rate.toFixed(2)}/GB`], ["Size", gb(ds.sizeGb)], ["Files", ds.files.toLocaleString()], ["Uploaded", fmtDate(ds.uploaded)]].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}
                </dl><p className="mt-2 text-xs text-muted">{ds.description}</p></div>

              <div><div className="mb-2 flex items-center justify-between"><SectionTitle>Quality checklist</SectionTitle><span className="text-xs text-muted">{checkDone}/{CHECKLIST.length}</span></div>
                <ul className="space-y-1.5">{CHECKLIST.map((c) => (
                  <li key={c}><label className={cn("flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-sm hover:bg-surface2", locked && "cursor-not-allowed opacity-70")}><input type="checkbox" className="mt-1" disabled={locked} checked={!!st.checklist[c]} onChange={(e) => setSt((s) => ({ ...s, checklist: { ...s.checklist, [c]: e.target.checked } }))} />{c}</label></li>))}</ul></div>

              <div><SectionTitle>Review notes</SectionTitle>
                <Textarea aria-label="Review notes" disabled={locked} placeholder="Internal notes (saved automatically)…" value={st.notes} onChange={(e) => setSt((s) => ({ ...s, notes: e.target.value }))} /></div>

              <div className="rounded-xl border border-line bg-surface2/50 p-4"><SectionTitle>Live estimate</SectionTitle>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="tabular text-lg font-semibold text-success">{gb(acc)}</p><p className="text-[11px] text-muted">Accepted</p></div>
                  <div><p className="tabular text-lg font-semibold text-danger">{gb(rej)}</p><p className="text-[11px] text-muted">Rejected</p></div>
                  <div><p className="tabular text-lg font-semibold">{gb(pend)}</p><p className="text-[11px] text-muted">Pending</p></div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm"><span className="text-muted">{gb(acc)} × ${rate.toFixed(2)} ({ds.kind})</span><span className="tabular text-lg font-semibold">{usd(acc * rate)}</span></div>
                <p className="mt-2 flex gap-1.5 text-[11px] text-muted"><Info size={12} className="mt-0.5 shrink-0" />Sampled files represent the full dataset. Only accepted, unique, eligible data earns. Payouts need manual approval.</p></div>

              <div><SectionTitle>Decision</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  <Button disabled={locked || !!blockers.approve} onClick={() => setDlg("approve")} title={blockers.approve}>Approve</Button>
                  <Button variant="secondary" disabled={locked || !!blockers.partial} onClick={() => setDlg("partial")} title={blockers.partial}>Partially approve</Button>
                  <Button variant="danger" disabled={locked} onClick={() => setDlg("reject")}>Reject</Button>
                  <Button variant="outline" disabled={locked} onClick={() => setDlg("changes")}>Request changes</Button>
                  <Button variant="ghost" className="col-span-2" disabled={!mine} onClick={() => setDlg("feedback")}>Send feedback</Button>
                </div>
                {!locked && (blockers.approve || blockers.partial) && <p className="mt-2 flex gap-1.5 text-xs text-warning"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{blockers.approve && `Approve: ${blockers.approve}. `}{blockers.partial && `Partial: ${blockers.partial}.`}</p>}
              </div>

              <div><SectionTitle>History</SectionTitle>
                <ol className="space-y-3 border-l border-line pl-4">{st.history.map((h, i) => (
                  <li key={i} className="relative text-sm"><span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand" /><p>{h.text}</p><p className="text-xs text-muted">{h.actor} · {h.at}</p></li>))}</ol></div>
            </div>
          </section>
        </div>
      </div>
      {dlg && <DecisionDialog kind={dlg} acc={acc} rej={rej} rate={rate} counts={counts} onClose={() => setDlg(null)} onSubmit={(m, r) => submit(dlg, m, r)} />}
    </FocusShell>
  );
}

function DecisionDialog({ kind, acc, rej, rate, counts, onClose, onSubmit }: { kind: Kind; acc: number; rej: number; rate: number; counts: { accepted: number; rejected: number }; onClose: () => void; onSubmit: (message: string, reason: string) => void }) {
  const [msg, setMsg] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const needMsg = kind === "changes" || kind === "feedback" || kind === "partial" || kind === "reject";
  const titles = { approve: "Approve dataset", partial: "Partially approve dataset", reject: "Reject dataset", changes: "Request changes", feedback: "Send feedback" };
  const go = () => {
    if (kind === "reject" && !reason) { setErr("Choose a rejection reason."); return; }
    if ((kind === "changes" || kind === "feedback") && msg.trim().length < 10) { setErr("Write at least 10 characters so the contributor knows what to do."); return; }
    if (kind === "partial" && msg.trim().length < 10) { setErr("Explain briefly why part of the data was rejected."); return; }
    onSubmit(msg.trim(), reason);
  };
  return (
    <Modal open onClose={onClose} title={titles[kind]}
      description={kind === "approve" || kind === "partial" ? `${gb(acc)} accepted${kind === "partial" ? `, ${gb(rej)} rejected` : ""}. Estimated earning ${usd(acc * rate)}.` : kind === "reject" ? "All files will be rejected. No earnings are credited." : kind === "changes" ? "The contributor can fix and resubmit. No earnings until approved." : "Sends a message without changing the review outcome."}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant={kind === "reject" ? "danger" : "primary"} onClick={go}>{kind === "feedback" ? "Send feedback" : `Confirm: ${titles[kind].split(" ")[0]}`}</Button></>}>
      <div className="space-y-3">
        {kind === "approve" && <Alert tone="info" title={`${counts.accepted} files accepted`}>Approval credits the estimated amount to the contributor as approved earnings. Payout still requires manual approval.</Alert>}
        {kind === "reject" && <Field label="Reason" required error={err && !reason ? err : undefined}>{(id, d) => <Select id={id} aria-describedby={d} value={reason} onChange={(e) => { setReason(e.target.value); setErr(""); }}><option value="">Select a reason…</option>{REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}</Select>}</Field>}
        {needMsg && <Field label={kind === "feedback" ? "Message to contributor" : "Message to contributor"} required={kind !== "reject"} error={err && (kind !== "reject" || reason) ? err : undefined}>{(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!err} value={msg} onChange={(e) => { setMsg(e.target.value); setErr(""); }} />}</Field>}
        <Badge tone="neutral">Simulated: no email or payment is sent in demo mode</Badge>
      </div>
    </Modal>
  );
}

function Paper({ file, page, zoom, decision }: { file: MockFile; page: number; zoom: number; decision: Decision }) {
  const isImg = ["JPG", "PNG", "TIF"].includes(file.type);
  const isTab = ["CSV", "JSON"].includes(file.type);
  return (
    <div className="mx-auto" style={{ width: `${(560 * zoom) / 100}px`, fontSize: `${(14 * zoom) / 100}px` }}>
      <article aria-label={`${file.name} page ${page}`} className="relative overflow-hidden rounded-md border border-line bg-surface shadow-card" style={{ padding: "2.5em", minHeight: "40em" }}>
        <span className={cn("absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", decision === "accepted" ? "bg-success-soft text-success" : decision === "rejected" ? "bg-danger-soft text-danger" : "bg-surface2 text-muted")}>{decision}</span>
        {isImg ? (
          <div className="flex flex-col gap-3">
            <div className="flex aspect-[4/3] items-center justify-center rounded bg-surface2 text-muted"><div className="text-center"><FileText size={40} className="mx-auto" /><p className="mt-2 text-xs">Image preview placeholder · {file.type}</p></div></div>
            <p lang="km" className="leading-loose">{KHMER_SAMPLE}</p>
          </div>
        ) : isTab ? (
          <div><p className="mb-3 font-mono text-xs text-muted">{file.name} · rows {(page - 1) * 20 + 1}–{page * 20}</p>
            <table className="w-full text-left font-mono" style={{ fontSize: "0.8em" }}><thead className="text-muted"><tr><th className="pb-1">id</th><th>province</th><th>price_khr</th></tr></thead>
              <tbody>{Array.from({ length: 12 }, (_, i) => <tr key={i} className="border-t border-line"><td className="py-1">{(page - 1) * 20 + i + 1}</td><td>Kampot</td><td>{4200 + ((i * 37 + page * 11) % 900)}</td></tr>)}</tbody></table></div>
        ) : (
          <>
            <p lang="km" className="text-center font-semibold" style={{ fontSize: "1.2em" }}>ព្រះរាជាណាចក្រកម្ពុជា</p>
            <p lang="km" className="text-center text-muted" style={{ fontSize: "0.9em" }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
            <hr className="my-4 border-line" />
            <p lang="km" className="leading-loose">{KHMER_SAMPLE}</p>
            <p className="mt-4 leading-relaxed text-muted">English summary: Ministry notice regarding the organisation of the civil registry. Sample text for demo purposes only.</p>
            <div className="mt-5 space-y-2" aria-hidden>{Array.from({ length: 9 }, (_, i) => <div key={i} className="h-2 rounded bg-surface2" style={{ width: `${95 - ((i * 13 + page * 7) % 40)}%` }} />)}</div>
            <p lang="km" className="mt-5 leading-loose">{KHMER_SAMPLE}</p>
          </>
        )}
        <p className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-muted">Page {page} of {file.pages} · DEMO PREVIEW, not a real document</p>
      </article>
    </div>
  );
}
