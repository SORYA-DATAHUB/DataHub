"use client";
import { Download, Lock, RefreshCw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { Tabs, useUI } from "@/components/ui/overlays";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, Stat, StatusBadge } from "@/components/ui/primitives";
import { useDemoState, wait } from "@/lib/demo";
import { datasetById } from "@/mock/data";
import { useState } from "react";
import { KV, Loadable, useQueryParam } from "./common";
import { useDatasetActions } from "./datasets-explorer";
import { fmtDate, filesFor, gb, rateFor, reviews, usd, type MockFile } from "./data";
import { useDatasets } from "./state";

const TABS = ["files", "reviews", "duplicates", "activity"] as const;
type Tab = (typeof TABS)[number];
const fileTone = { clean: "success", duplicate: "warning", low_quality: "warning", scan_flagged: "danger" } as const;

export function AdminDatasetDetail({ id }: { id: string }) {
  if (!datasetById(id)) notFound();
  return <Loadable><Inner id={id} /></Loadable>;
}

function Inner({ id }: { id: string }) {
  const { toast, confirm } = useUI();
  const { datasets } = useDatasets();
  const actions = useDatasetActions();
  const d = datasets.find((x) => x.id === id)!;
  const [tabRaw, setTab] = useQueryParam("tab", "files");
  const tab = (TABS as readonly string[]).includes(tabRaw) ? (tabRaw as Tab) : "files";
  const [authorized, setAuthorized] = useDemoState<boolean>(`admin-download-auth-${id}`, false);
  const [scanning, setScanning] = useState(false);
  const files = filesFor(d);
  const dups = files.filter((f) => f.status === "duplicate");
  const revs = reviews.filter((r) => r.datasetId === id);
  const est = d.acceptedGb * rateFor(d.kind);

  const rescan = async () => { setScanning(true); await wait(1200); setScanning(false); toast(`Rescan of ${d.id} finished (simulated): no new findings.`); };
  const authorize = async () => {
    if (await confirm({ title: "Authorize download?", description: "Downloading raw dataset files is logged in the audit trail. In the demo no real file is produced.", confirmLabel: "Authorize" })) { setAuthorized(true); toast("Download authorized for this session (demo)."); }
  };

  const cols: Column<MockFile>[] = [
    { key: "n", header: "File", sortValue: (f) => f.name, render: (f) => <div className="min-w-0"><p className="truncate font-mono text-xs font-medium">{f.name}</p>{f.note && <p className="text-xs text-muted">{f.note}</p>}</div> },
    { key: "t", header: "Type", render: (f) => f.type },
    { key: "s", header: "Size", sortValue: (f) => f.sizeGb, render: (f) => <span className="tabular">{gb(f.sizeGb)}</span> },
    { key: "p", header: "Pages", render: (f) => f.pages, hideOnMobile: true },
    { key: "st", header: "Scan", sortValue: (f) => f.status, render: (f) => <Badge tone={fileTone[f.status]} dot>{f.status.replace("_", " ")}</Badge> },
    { key: "a", header: "", render: (f) => <Button size="sm" variant="ghost" disabled={!authorized} title={authorized ? "" : "Authorize download first"} onClick={() => toast(`Simulated download of ${f.name}. No real file exists.`, "info")}><Download size={14} /></Button> }
  ];

  return (
    <>
      <PageHeader title={d.title} description={`${d.id} · ${d.category} · ${d.language} · owned by ${d.owner}`}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Datasets", href: "/admin/datasets" }, { label: d.id }]}
        actions={<>
          <Button variant="outline" onClick={() => actions.message(d)}>Message owner</Button>
          <Button variant="outline" loading={scanning} onClick={rescan}><RefreshCw size={14} />Rescan</Button>
          {authorized ? <Button variant="outline" onClick={() => toast("Simulated download started. No real archive exists in demo mode.", "info")}><Download size={14} />Download (simulated)</Button>
            : <Button variant="outline" onClick={authorize}><Lock size={14} />Authorize download</Button>}
          <Button variant="danger" disabled={d.takedown} onClick={() => actions.takedown(d)}>{d.takedown ? "Taken down" : "Take down"}</Button>
        </>} />
      {d.takedown && <div className="mb-4"><Alert tone="danger" title="This dataset was taken down">It is hidden from the platform and earnings are on hold.</Alert></div>}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Status" value={<StatusBadge status={d.status} />} />
        <Stat label="Size" value={gb(d.sizeGb)} hint={`${d.files.toLocaleString()} files`} />
        <Stat label="Accepted" value={gb(d.acceptedGb)} tone="success" />
        <Stat label={`Earnings (${d.kind} $${rateFor(d.kind).toFixed(2)}/GB)`} value={usd(est)} tone="success" />
        <Stat label="Quality" value={d.qualityScore ?? "n/a"} />
      </div>
      <Tabs tabs={[{ id: "files", label: "Files", count: files.length }, { id: "reviews", label: "Reviews", count: revs.length }, { id: "duplicates", label: "Duplicates", count: dups.length }, { id: "activity", label: "Activity" }]} value={tab} onChange={setTab} />
      <div className="mt-5" role="tabpanel">
        {tab === "files" && <>
          {!authorized && <div className="mb-3"><Alert tone="info" title="Downloads are locked">Authorize download above to enable per-file download. Sample of {files.length} of {d.files.toLocaleString()} files shown.</Alert></div>}
          <DataTable rows={files} columns={cols} searchText={(f) => f.name} pageSize={8}
            filters={[{ label: "Scan", options: ["clean", "duplicate", "low_quality", "scan_flagged"], predicate: (f, v) => f.status === v }]} />
        </>}
        {tab === "reviews" && (revs.length === 0 ? <Card><EmptyState title="No reviews yet" description="This dataset has not been submitted for review." /></Card> :
          <Card><ul className="divide-y divide-line">{revs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"><div className="min-w-0 flex-1"><p className="font-medium">{r.id}{r.outcome ? ` · ${r.outcome}` : ""}</p><p className="text-xs text-muted">Submitted {fmtDate(r.submitted)} · {r.claimedBy ?? "unclaimed"}</p></div>
              <StatusBadge status={r.status === "completed" ? "completed" : r.status} /><Button size="sm" variant="outline" href={`/review/datasets/${r.id}`}>Open workspace</Button></li>))}</ul></Card>)}
        {tab === "duplicates" && (dups.length === 0 ? <Card><EmptyState title="No duplicates detected" /></Card> :
          <Card><CardHeader title="Duplicate matches" description="Duplicate data is not eligible for payment." /><ul className="divide-y divide-line">{dups.map((f) => (
            <li key={f.id} className="px-5 py-3 text-sm"><p className="font-mono text-xs font-medium">{f.name}</p><p className="text-xs text-muted">{f.note} · {gb(f.sizeGb)} excluded from earnings</p></li>))}</ul></Card>)}
        {tab === "activity" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2"><ol className="space-y-4">{[
              [fmtDate(d.uploaded), `Uploaded by ${d.owner}`], [fmtDate(d.uploaded), "Virus scan and de-duplication completed"],
              ...revs.map((r) => [fmtDate(r.submitted), `Review ${r.id} ${r.status === "completed" ? `finished: ${r.outcome}` : r.status.replace("_", " ")}`]),
              ...(d.takedown ? [["Today", "Taken down by admin"]] : [])].map(([t, x], i) => (
              <li key={i} className="flex gap-3 text-sm"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" /><div><p>{x}</p><p className="text-xs text-muted">{t}</p></div></li>))}</ol></Card>
            <Card className="px-5 py-3"><dl className="divide-y divide-line"><KV k="Owner" v={<Link href={`/admin/users/${d.ownerId}`} className="text-brand hover:underline">{d.owner}</Link>} /><KV k="Type" v={d.kind} /><KV k="Language" v={d.language} /><KV k="Uploaded" v={fmtDate(d.uploaded)} /></dl></Card>
          </div>
        )}
      </div>
    </>
  );
}
