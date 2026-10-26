"use client";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/ui/overlays";
import { Alert, Card, EmptyState, PageHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { gb } from "@/lib/cn";
import { useDemoState, useFakeLoad, wait } from "@/lib/demo";
import { fmtBytes } from "./data";
import { useDatasets } from "./hooks";
import { MB, useUploadQueue, type UpFile } from "./upload-engine";
import { UploadPanel } from "./upload-panel";

/** A believable interrupted queue for datasets that were left in "uploading" without a saved draft. */
function defaultQueue(id: string): UpFile[] {
  const names = ["temple_inscription_001.jpg", "temple_inscription_002.jpg", "temple_inscription_003.jpg", "temple_inscription_004.jpg", "temple_inscription_005.jpg", "temple_inscription_006.jpg", "temple_inscription_007.jpg", "temple_inscription_008.jpg"];
  return names.map((name, i) => ({
    id: `${id}-${i}`, name, size: (180 + i * 37) * MB, speed: 0,
    progress: i < 3 ? 100 : i === 3 ? 58 : 0,
    status: i < 3 ? "done" : i === 3 ? "paused" : i === 4 ? "failed" : "queued",
    error: i === 4 ? "Connection lost while uploading. Retry resumes from the last completed part." : undefined
  }));
}

export function UploadResume({ id }: { id: string }) {
  const router = useRouter();
  const { toast, confirm } = useUI();
  const loading = useFakeLoad(500);
  const { datasets, patch } = useDatasets();
  const [saved, , clearSaved] = useDemoState<UpFile[] | null>(`contrib:upq:${id}`, null);
  const q = useUploadQueue();
  const seeded = useRef(false);
  const [finishing, setFinishing] = useState(false);
  const d = datasets.find((x) => x.id === id);
  const { setFiles } = q;
  useEffect(() => {
    if (loading || seeded.current || !d) return;
    seeded.current = true;
    setFiles(saved && saved.length ? saved : defaultQueue(id));
  }, [loading, d, saved, id, setFiles]);

  if (loading) return <div className="space-y-4" aria-busy="true"><Skeleton className="h-10 w-72" /><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;
  if (!d) return <Card><EmptyState title="Dataset not found" description={`No dataset with ID ${id} exists in your account.`} action={<Button href="/datasets">My datasets</Button>} /></Card>;
  if (d.status !== "uploading" && d.status !== "changes_requested") return (
    <Card><EmptyState icon={CheckCircle2} title="Nothing left to upload" description={`${d.id} is ${d.status.replace(/_/g, " ")}. Only datasets still uploading or needing changes accept new files.`}
      action={<Button href={`/datasets/${d.id}`}>View dataset</Button>} /></Card>
  );
  const s = q.stats;
  const ready = s.count.done > 0 && s.count.active === 0 && s.count.paused === 0;
  const finish = async () => {
    const ok = await confirm({ title: "Finish and submit for review?", description: `${s.count.done} uploaded files (${fmtBytes(s.doneBytes)}) will be sent for processing. ${s.count.failed + s.count.duplicate + s.count.invalid} file(s) will be left out.`, confirmLabel: "Submit" });
    if (!ok) return;
    setFinishing(true); await wait(900);
    patch(d.id, { status: d.status === "changes_requested" ? "pending_review" : "processing", files: Math.max(d.files, s.count.done) });
    clearSaved(); setFinishing(false);
    toast("Upload finished (simulated). Your dataset is now in the review pipeline.");
    router.push(`/datasets/${d.id}`);
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ label: "My datasets", href: "/datasets" }, { label: d.id, href: `/datasets/${d.id}` }, { label: "Upload" }]} title="Upload progress" description={`${d.title}. Pause, resume or retry any file. Progress is saved in this browser.`}
        actions={<><StatusBadge status={d.status} /><Button variant="outline" href={`/datasets/${d.id}`}>Back to dataset</Button></>} />
      {s.count.failed > 0 && <div className="mb-4"><Alert tone="danger" title={`${s.count.failed} file${s.count.failed > 1 ? "s" : ""} failed`}>Use the retry button on each file, or Retry failed to resume them all.</Alert></div>}
      <UploadPanel q={q} />
      <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted">{ready ? `${s.count.done} files are uploaded (${gb(s.doneBytes / 1073741824)}). Estimated earnings are not paid until reviewers accept them.` : "Finish or pause every file to continue."}</p>
        <Button disabled={!ready} loading={finishing} onClick={() => { void finish(); }}>Finish and submit for review</Button>
      </Card>
    </>
  );
}
