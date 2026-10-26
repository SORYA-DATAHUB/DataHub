"use client";
import { ChevronLeft, ChevronRight, CloudUpload, Database, LayoutGrid, List, Rows3, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/overlays";
import { Card, EmptyState, ErrorState, Input, PageHeader, Progress, Select, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { cn, gb, usd } from "@/lib/cn";
import { useDemoState, useFakeLoad } from "@/lib/demo";
import { CATEGORY_HINTS, STATUSES, STATUS_LABEL, approvedEarnings, canResubmit, estimatedEarnings, fmtDate, type CDataset } from "./data";
import { useDatasets, useForcedState, useQueryParam, useResubmit } from "./hooks";

type View = "table" | "grid" | "list";
type Sort = "newest" | "oldest" | "size" | "title";
const PAGE = 8;

export function DatasetsList() {
  const router = useRouter();
  const loading = useFakeLoad(500);
  const { forced, clear } = useForcedState();
  const { datasets, patch } = useDatasets();
  const resubmit = useResubmit(patch);
  const [status, setStatus] = useQueryParam("status", "all");
  const [view, setView] = useDemoState<View>("contrib:datasets-view", "table");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const r = datasets.filter((d) => (status === "all" || d.status === status) && (cat === "all" || d.category === cat)
      && (!q || `${d.title} ${d.id} ${d.category} ${d.language}`.toLowerCase().includes(q.toLowerCase())));
    const cmp: Record<Sort, (a: CDataset, b: CDataset) => number> = {
      newest: (a, b) => b.uploaded.localeCompare(a.uploaded), oldest: (a, b) => a.uploaded.localeCompare(b.uploaded),
      size: (a, b) => b.sizeGb - a.sizeGb, title: (a, b) => a.title.localeCompare(b.title)
    };
    return [...r].sort(cmp[sort]);
  }, [datasets, status, cat, q, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages);
  const slice = rows.slice((cur - 1) * PAGE, cur * PAGE);
  const filtered = q !== "" || status !== "all" || cat !== "all";
  const clearAll = () => { setQ(""); setCat("all"); setStatus(null); setPage(1); };

  const actions = (d: CDataset) => [
    { label: "View details", onClick: () => router.push(`/datasets/${d.id}`) },
    ...(d.status === "uploading" ? [{ label: "Continue upload", onClick: () => router.push(`/datasets/${d.id}/upload`) }] : []),
    ...(canResubmit(d.status) ? [{ label: "Resubmit for review", onClick: () => { void resubmit(d); } }] : []),
    { label: "Message reviewer", onClick: () => router.push("/messages") }
  ];
  const value = (d: CDataset) => (d.acceptedGb > 0 ? { v: usd(approvedEarnings(d)), l: "approved" } : estimatedEarnings(d) > 0 ? { v: usd(estimatedEarnings(d)), l: "estimated" } : { v: "$0.00", l: "earned" });

  return (
    <>
      <PageHeader title="My datasets" description="Everything you have uploaded and where it is in review."
        actions={<Button href="/datasets/new"><CloudUpload size={14} />Upload dataset</Button>} />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-48 flex-1 sm:max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <Input aria-label="Search datasets" placeholder="Search title, ID, language…" className="pl-8" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <Select aria-label="Status" className="w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">Status: All</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </Select>
          <Select aria-label="Category" className="w-auto" value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }}>
            <option value="all">Category: All</option>{Object.keys(CATEGORY_HINTS).map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select aria-label="Sort by" className="w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="newest">Sort: Newest</option><option value="oldest">Sort: Oldest</option><option value="size">Sort: Largest</option><option value="title">Sort: Title A-Z</option>
          </Select>
          <div role="group" aria-label="View" className="ml-auto flex rounded-lg bg-surface2 p-0.5">
            {([["table", Rows3, "Table"], ["list", List, "List"], ["grid", LayoutGrid, "Grid"]] as const).map(([v, I, label]) => (
              <button key={v} aria-label={`${label} view`} aria-pressed={view === v} onClick={() => setView(v)}
                className={cn("flex h-8 w-8 items-center justify-center rounded-md", view === v ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg")}><I size={15} /></button>))}
          </div>
        </div>

        {forced === "error" ? <ErrorState onRetry={clear} />
          : loading ? <div className="space-y-3 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
          : forced === "empty" || datasets.length === 0 ? <EmptyState icon={Database} title="No datasets yet" description="Upload your first dataset. Only accepted, unique data earns." action={<Button href="/datasets/new">Upload dataset</Button>} />
          : rows.length === 0 ? <EmptyState icon={SearchX} title="No datasets match" description="Try a different search or clear the filters." action={filtered && <Button variant="outline" onClick={clearAll}>Clear filters</Button>} />
          : (
            <>
              {view === "table" && (
                <>
                  <div className="scroll-thin hidden overflow-x-auto md:block">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface2/60 text-xs text-muted"><tr>{["Dataset", "Category", "Status", "Size", "Accepted", "Earnings", "Uploaded", ""].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">{h || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
                      <tbody className="divide-y divide-line">{slice.map((d) => (
                        <tr key={d.id} className="hover:bg-surface2/50">
                          <td className="max-w-72 px-4 py-3"><Link href={`/datasets/${d.id}`} className="block truncate font-medium hover:text-brand">{d.title}</Link><span className="text-xs text-muted">{d.id} · {d.kind === "raw" ? "Raw" : "Labeled"} · {d.language}</span></td>
                          <td className="px-4 py-3 text-muted">{d.category}</td>
                          <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                          <td className="tabular px-4 py-3">{gb(d.sizeGb)}</td>
                          <td className="tabular px-4 py-3">{gb(d.acceptedGb)}</td>
                          <td className="tabular px-4 py-3"><span className="font-medium">{value(d).v}</span> <span className="text-xs text-muted">{value(d).l}</span></td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtDate(d.uploaded)}</td>
                          <td className="px-2 py-3 text-right"><Menu label={`Actions for ${d.id}`} items={actions(d)} /></td>
                        </tr>))}</tbody>
                    </table>
                  </div>
                  <ul className="divide-y divide-line md:hidden">{slice.map((d) => <MobileRow key={d.id} d={d} />)}</ul>
                </>
              )}
              {view === "list" && <ul className="divide-y divide-line">{slice.map((d) => (
                <li key={d.id} className="flex items-center gap-4 px-4 py-3.5">
                  <Link href={`/datasets/${d.id}`} className="min-w-0 flex-1"><span className="block truncate text-sm font-medium hover:text-brand">{d.title}</span><span className="text-xs text-muted">{d.id} · {d.category} · {gb(d.sizeGb)} · {fmtDate(d.uploaded)}</span></Link>
                  <span className="hidden text-right text-xs sm:block"><span className="tabular block text-sm font-medium">{value(d).v}</span><span className="text-muted">{value(d).l}</span></span>
                  <StatusBadge status={d.status} /><Menu label={`Actions for ${d.id}`} items={actions(d)} />
                </li>))}</ul>}
              {view === "grid" && <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">{slice.map((d) => (
                <li key={d.id} className="flex flex-col rounded-xl border border-line p-4 transition-colors hover:border-brand/50">
                  <div className="flex items-start justify-between gap-2"><StatusBadge status={d.status} /><Menu label={`Actions for ${d.id}`} items={actions(d)} /></div>
                  <Link href={`/datasets/${d.id}`} className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold hover:text-brand">{d.title}</Link>
                  <p className="mt-1 text-xs text-muted">{d.id} · {d.category}</p>
                  <div className="mt-4 space-y-1.5"><div className="flex justify-between text-xs text-muted"><span>{gb(d.acceptedGb)} accepted</span><span>{gb(d.sizeGb)}</span></div><Progress value={(d.acceptedGb / d.sizeGb) * 100} tone="success" label="Accepted share" /></div>
                  <div className="mt-4 flex items-end justify-between border-t border-line pt-3"><span className="text-xs text-muted">{fmtDate(d.uploaded)}</span><span className="text-right"><span className="tabular block text-sm font-semibold">{value(d).v}</span><span className="text-[11px] text-muted">{value(d).l}</span></span></div>
                </li>))}</ul>}
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
                <span>{rows.length} dataset{rows.length === 1 ? "" : "s"} · page {cur} of {pages}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft size={14} /></Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight size={14} /></Button>
                </div>
              </div>
            </>
          )}
      </Card>
    </>
  );
}

function MobileRow({ d }: { d: CDataset }) {
  return (
    <li><Link href={`/datasets/${d.id}`} className="block space-y-1.5 p-4">
      <span className="flex items-start justify-between gap-3"><span className="font-medium">{d.title}</span><StatusBadge status={d.status} /></span>
      <span className="block text-xs text-muted">{d.id} · {d.category} · {gb(d.sizeGb)} · {fmtDate(d.uploaded)}</span>
    </Link></li>
  );
}
