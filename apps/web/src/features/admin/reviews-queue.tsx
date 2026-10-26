"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { useUI } from "@/components/ui/overlays";
import { Badge, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { datasetById } from "@/mock/data";
import { useDemoState } from "@/lib/demo";
import { Loadable, useQueryParam } from "./common";
import { ageDays, fmtDate, gb, reviews, type Review } from "./data";

export function AdminReviews() {
  const router = useRouter();
  const { toast } = useUI();
  const [status] = useQueryParam("status");
  const [claims, setClaims] = useDemoState<Record<string, string>>("admin-review-claims", {});
  const all = reviews.filter((r) => r.status !== "completed").map((r) => ({ ...r, claimedBy: r.claimedBy ?? claims[r.id] ?? null, status: (claims[r.id] ? "in_review" : r.status) as Review["status"] }));
  const rows = status === "submitted" || status === "in_review" ? all.filter((r) => r.status === status) : all;

  const claim = (r: Review) => { setClaims((c) => ({ ...c, [r.id]: "Anna Keller" })); toast(`You claimed ${r.id}. Opening workspace…`); router.push(`/review/datasets/${r.id}`); };
  const cols: Column<Review>[] = [
    { key: "id", header: "Review", sortValue: (r) => r.id, render: (r) => { const d = datasetById(r.datasetId); return <div className="min-w-0"><p className="truncate font-medium">{d?.title}</p><p className="text-xs text-muted">{r.id} · {r.datasetId} · {d?.owner}</p></div>; } },
    { key: "size", header: "Size", sortValue: (r) => datasetById(r.datasetId)?.sizeGb ?? 0, render: (r) => gb(datasetById(r.datasetId)?.sizeGb ?? 0) },
    { key: "age", header: "Age", sortValue: (r) => ageDays(r.submitted), render: (r) => { const a = ageDays(r.submitted); return <Badge tone={a > 7 ? "danger" : a > 3 ? "warning" : "neutral"}>{a}d · {fmtDate(r.submitted)}</Badge>; }, hideOnMobile: true },
    { key: "by", header: "Claimed by", render: (r) => r.claimedBy ?? <span className="text-muted">Unclaimed</span> },
    { key: "st", header: "Status", sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: "a", header: "", render: (r) => r.claimedBy && r.claimedBy !== "Anna Keller" ? <Button size="sm" variant="outline" href={`/review/datasets/${r.id}`}>Open</Button> : r.claimedBy ? <Button size="sm" href={`/review/datasets/${r.id}`}>Continue</Button> : <Button size="sm" onClick={(e) => { e.stopPropagation(); claim(r); }}>Claim review</Button> }
  ];
  return (
    <Loadable>
      <PageHeader title="Review queue" description="Submitted and in-review datasets awaiting a decision." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Review queue" }]} />
      <DataTable rows={rows} columns={cols} searchText={(r) => `${r.id} ${r.datasetId} ${datasetById(r.datasetId)?.title}`} onRowClick={(r) => router.push(`/admin/datasets/${r.datasetId}?tab=reviews`)}
        filters={[{ label: "Status", options: ["submitted", "in_review"], predicate: (r, v) => r.status === v }]} empty={{ title: "Nothing waiting", description: "All submitted datasets have been decided." }} />
    </Loadable>
  );
}
