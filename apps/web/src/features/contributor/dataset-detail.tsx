"use client";
import { CloudUpload, FileSearch, MessageSquareWarning, RotateCw } from "lucide-react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Drawer, Tabs, useUI } from "@/components/ui/overlays";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, Progress, Skeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { cn, gb, usd } from "@/lib/cn";
import { useFakeLoad } from "@/lib/demo";
import { KHMER_SAMPLE } from "@/mock/data";
import { ChatThread } from "@/features/messaging/chat";
import { useConversations } from "@/features/messaging/store";
import type { Conversation } from "@/features/messaging/types";
import { STATUS_LABEL, approvedEarnings, canResubmit, estimatedEarnings, feedbackFor, fmtDate, fmtDateTime, fmtMb, generateFiles, rate, timeline, type DFile, type FileStatus } from "./data";
import { useDatasets, useQueryParam, useResubmit } from "./hooks";
import { convoSeeds, ME_ID } from "./messages-seed";

const TABS = ["files", "feedback", "history"] as const;
type Tab = (typeof TABS)[number];
const TONE: Record<string, string> = { neutral: "bg-line", brand: "bg-brand", success: "bg-success", warning: "bg-warning", danger: "bg-danger" };

export function DatasetDetail({ id }: { id: string }) {
  const loading = useFakeLoad(500);
  const router = useRouter();
  const { toast } = useUI();
  const { datasets, patch } = useDatasets();
  const resubmit = useResubmit(patch);
  const convos = useConversations("contrib:convos", convoSeeds);
  const [tabRaw, setTab] = useQueryParam("tab", "files");
  const [fileId, setFile] = useQueryParam("file", "");
  const tab: Tab = (TABS as readonly string[]).includes(tabRaw) ? (tabRaw as Tab) : "files";
  const d = datasets.find((x) => x.id === id);
  const files = useMemo(() => (d ? generateFiles(d) : []), [d]);

  if (loading) return <div className="space-y-4" aria-busy="true"><Skeleton className="h-10 w-80" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-96" /></div>;
  if (!d) return (
    <Card><EmptyState title="Dataset not found" description={`We could not find a dataset with ID ${id} in your account. It may belong to another contributor or have been removed.`}
      action={<Button href="/datasets">Back to my datasets</Button>} /></Card>
  );

  const fb = feedbackFor(d);
  const events = timeline(d);
  const approved = approvedEarnings(d);
  const estimated = estimatedEarnings(d);
  const potential = d.status === "partially_approved" || d.status === "changes_requested" ? Math.max(0, d.sizeGb - d.acceptedGb) * rate(d.kind) : 0;
  const openFile = files.find((f) => f.id === fileId);
  const conv: Conversation = convos.conversations.find((c) => c.datasetId === d.id) ?? {
    id: `c-${d.id}`, subject: `${d.id}: ${d.title}`, topic: "dataset", datasetId: d.id, unread: 0, updatedAt: new Date(0).toISOString(),
    counterpart: { id: "u-4", name: "Vireak Ly", role: "Reviewer" }, messages: []
  };
  const exists = convos.conversations.some((c) => c.id === conv.id);
  const sendMsg = (body: string, attachments: { name: string; sizeKb: number }[]) => {
    const at = new Date().toISOString();
    const m = { id: `m-${Date.now()}`, authorId: ME_ID, authorName: "Sokha Chan", authorRole: "Contributor" as const, body, at, attachments: attachments.length ? attachments : undefined };
    if (exists) convos.send(conv.id, m); else convos.create({ ...conv, messages: [m], updatedAt: at });
    toast("Message sent to the reviewer. Demo mode: no real person will reply.");
  };

  const cols: Column<DFile>[] = [
    { key: "name", header: "File", sortValue: (f) => f.name, render: (f) => <span className="font-medium">{f.name}</span> },
    { key: "size", header: "Size", sortValue: (f) => f.sizeMb, render: (f) => <span className="tabular">{fmtMb(f.sizeMb)}</span> },
    { key: "status", header: "Status", sortValue: (f) => f.status, render: (f) => <StatusBadge status={f.status === "uploading" ? "uploading" : f.status === "pending" ? "pending" : f.status} /> },
    { key: "reason", header: "Reason", hideOnMobile: true, render: (f) => <span className="text-muted">{f.reason ?? "-"}</span> }
  ];

  return (
    <>
      <PageHeader breadcrumbs={[{ label: "My datasets", href: "/datasets" }, { label: d.id }]} title={d.title} description={d.description}
        actions={<>
          <StatusBadge status={d.status} />
          {d.status === "uploading" && <Button href={`/datasets/${d.id}/upload`}><CloudUpload size={14} />Continue upload</Button>}
          {canResubmit(d.status) && <Button onClick={() => { void resubmit(d); }}><RotateCw size={14} />Resubmit for review</Button>}
        </>} />
      <div className="mb-6">
        {d.status === "changes_requested" && <Alert tone="warning" title="The reviewer asked for changes" action={<Button size="sm" variant="outline" onClick={() => setTab("feedback")}>See feedback</Button>}>Fix the flagged files, then resubmit. Earnings are credited only for accepted files.</Alert>}
        {d.status === "partially_approved" && <Alert tone="info" title="Part of this dataset was accepted">{gb(d.acceptedGb)} earned {usd(approved)}. You can fix the rejected files and resubmit them for more.</Alert>}
        {d.status === "rejected" && <Alert tone="danger" title="This dataset was rejected">No data from it is eligible to earn. Read the feedback and message the reviewer if you disagree.</Alert>}
        {d.status === "approved" && <Alert tone="success" title="Approved and credited">{usd(approved)} was added to your available balance. Withdrawals still require manual approval.</Alert>}
        {(d.status === "pending_review" || d.status === "processing") && <Alert tone="info" title={d.status === "processing" ? "Processing your files" : "Waiting for review"}>Estimated earnings below are not paid until files are accepted.</Alert>}
        {d.status === "uploading" && <Alert tone="info" title="Upload not finished" action={<Button size="sm" variant="outline" href={`/datasets/${d.id}/upload`}>Resume</Button>}>Only complete uploads can be reviewed.</Alert>}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total size" value={gb(d.sizeGb)} hint={`${d.files.toLocaleString()} files`} />
        <Stat label="Accepted" value={gb(d.acceptedGb)} hint={d.sizeGb ? `${Math.round((d.acceptedGb / d.sizeGb) * 100)}% of upload` : undefined} tone="success" />
        <Stat label="Approved earnings" value={usd(approved)} hint={`${gb(d.acceptedGb)} x ${usd(rate(d.kind))}`} tone="success" />
        <Stat label="Estimated earnings" value={usd(estimated || potential)} hint={estimated ? "Not paid until approved" : potential ? "Potential if fixed and accepted" : "Nothing pending"} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="px-3"><Tabs tabs={[{ id: "files", label: "Files", count: d.files }, { id: "feedback", label: "Reviewer feedback", count: fb.length }, { id: "history", label: "History" }]} value={tab} onChange={(t) => setTab(t)} /></div>
            <div role="tabpanel">
              {tab === "files" && (
                <div className="p-3">
                  <p className="mb-3 text-xs text-muted">Showing {files.length} of {d.files.toLocaleString()} files. Select a file to preview it.</p>
                  <DataTable rows={files} columns={cols} searchText={(f) => `${f.name} ${f.reason ?? ""}`} pageSize={8} onRowClick={(f) => setFile(f.id)}
                    filters={[{ label: "Status", options: ["accepted", "rejected", "pending", "processing", "uploading"], predicate: (f, v) => f.status === (v as FileStatus) }]}
                    empty={{ title: "No files", description: "No files match these filters." }} />
                </div>
              )}
              {tab === "feedback" && (
                fb.length === 0 ? <EmptyState icon={MessageSquareWarning} title="No reviewer feedback yet" description="You will be notified as soon as a reviewer comments on this dataset." />
                  : <ul className="divide-y divide-line">{fb.map((f) => (
                    <li key={f.id} className="space-y-2 p-5">
                      <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{f.author}</span><Badge tone="brand">{f.role}</Badge>
                        <Badge tone={f.kind === "approved" ? "success" : f.kind === "rejected" ? "danger" : "warning"} dot>{f.kind === "changes" ? "Changes requested" : f.kind === "approved" ? "Approved" : f.kind === "rejected" ? "Rejected" : "Note"}</Badge>
                        <span className="text-xs text-muted">{fmtDate(f.at)}</span></div>
                      <p className="text-sm">{f.body}</p>
                      {f.items && <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{f.items.map((i) => <li key={i}>{i}</li>)}</ul>}
                      {canResubmit(d.status) && f.kind !== "note" && <Button size="sm" variant="outline" onClick={() => { void resubmit(d); }}>Resubmit after fixing</Button>}
                    </li>))}</ul>
              )}
              {tab === "history" && (
                <ol className="p-5">{events.map((e, i) => (
                  <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < events.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-line" aria-hidden />}
                    <span className={cn("relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-surface", TONE[e.tone])} aria-hidden />
                    <div><p className="text-sm font-medium">{e.title}</p>{e.detail && <p className="text-sm text-muted">{e.detail}</p>}<p className="text-xs text-muted">{fmtDate(e.at)}</p></div>
                  </li>))}</ol>
              )}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Discussion with reviewer" description="Ask about feedback or share fixes. Linked to this dataset." />
            <ChatThread className="h-[460px]" conversation={conv} viewerId={ME_ID} onSend={sendMsg} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Earnings" description={d.kind === "raw" ? "Raw data: $1.00 per accepted GB" : "Labeled data: $1.50 per accepted GB"} />
            <dl className="space-y-3 p-5 text-sm">
              <Row k="Approved (accepted GB x rate)" v={usd(approved)} strong />
              <Row k="Estimated (awaiting review)" v={usd(estimated)} />
              {potential > 0 && <Row k="Potential if rejected files fixed" v={usd(potential)} />}
              <div className="pt-1"><Progress value={d.sizeGb ? (d.acceptedGb / d.sizeGb) * 100 : 0} tone="success" label="Accepted share of upload" /><p className="mt-1.5 text-xs text-muted">Only accepted, unique and eligible data earns.</p></div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Metadata" />
            <dl className="space-y-3 p-5 text-sm">
              <Row k="Dataset ID" v={d.id} /><Row k="Category" v={d.category} /><Row k="Language" v={d.language} /><Row k="Type" v={d.kind === "raw" ? "Raw" : "Labeled"} />
              {d.source && <Row k="Source" v={d.source} />}<Row k="Uploaded" v={fmtDate(d.uploaded)} /><Row k="Status" v={STATUS_LABEL[d.status]} />
              <Row k="Quality score" v={d.qualityScore === null ? "Not scored yet" : `${d.qualityScore} / 100`} />
            </dl>
          </Card>
          <Button variant="outline" className="w-full" onClick={() => router.push("/messages")}>Open all messages</Button>
        </div>
      </div>

      <Drawer open={!!openFile} onClose={() => setFile(null)} title={openFile?.name ?? "File"} description={openFile ? `${d.id} · ${fmtMb(openFile.sizeMb)}` : undefined}
        footer={openFile && <>
          {openFile.status === "rejected" && <Button variant="outline" onClick={() => { toast("Replacement upload is simulated in demo mode.", "info"); }}>Replace file</Button>}
          <Button onClick={() => setFile(null)}>Close</Button></>}>
        {openFile && <FilePreview f={openFile} khmer={d.language.includes("Khmer")} />}
      </Drawer>
    </>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-muted">{k}</dt><dd className={cn("tabular text-right", strong && "font-semibold")}>{v}</dd></div>;
}

function FilePreview({ f, khmer }: { f: DFile; khmer: boolean }) {
  const image = ["jpg", "png", "tif"].includes(f.ext);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2"><StatusBadge status={f.status === "pending" ? "pending" : f.status} /><span className="text-xs text-muted">Mock preview. Real file contents are not stored in demo mode.</span></div>
      {f.reason && <Alert tone="danger" title="Why this file was rejected">{f.reason}</Alert>}
      <div className="overflow-hidden rounded-xl border border-line bg-surface2">
        {image ? (
          <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-brand-soft via-surface2 to-warning-soft text-muted"><FileSearch size={36} aria-hidden /><span className="sr-only">Image placeholder</span></div>
        ) : f.ext === "csv" ? (
          <table className="w-full text-left text-xs"><thead className="bg-surface text-muted"><tr><th className="p-2">date</th><th className="p-2">item</th><th className="p-2">price_khr</th></tr></thead>
            <tbody className="divide-y divide-line">{[["2024-01-02", "Rice (1 kg)", "2,800"], ["2024-01-02", "Pork (1 kg)", "14,500"], ["2024-01-09", "Rice (1 kg)", "2,850"], ["2024-01-09", "Fish (1 kg)", "11,000"]].map((r) => <tr key={r.join()}>{r.map((c) => <td key={c} className="p-2">{c}</td>)}</tr>)}</tbody></table>
        ) : (
          <div className="mx-auto my-4 w-4/5 space-y-2 rounded bg-surface p-5 shadow-card">
            {khmer ? <p className="khmer text-sm">{KHMER_SAMPLE}</p> : <p className="text-sm">The committee reviewed the annual report and recommended that the findings be published for public use.</p>}
            {[92, 100, 85, 96, 70].map((w, i) => <div key={i} className="h-2 rounded bg-line" style={{ width: `${w}%` }} />)}
          </div>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted">Format</dt><dd className="uppercase">{f.ext}</dd></div>
        <div><dt className="text-xs text-muted">Size</dt><dd>{fmtMb(f.sizeMb)}</dd></div>
        <div><dt className="text-xs text-muted">Checksum</dt><dd className="truncate font-mono text-xs">sha256:{f.id}9f3c…e21a</dd></div>
        <div><dt className="text-xs text-muted">Last checked</dt><dd>{fmtDateTime("2026-10-24T09:00:00Z")}</dd></div>
      </dl>
    </div>
  );
}
