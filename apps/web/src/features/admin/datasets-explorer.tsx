"use client";
import { LayoutGrid, Rows3, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { Menu, useUI } from "@/components/ui/overlays";
import { Badge, Card, EmptyState, Input, PageHeader, Select, StatusBadge } from "@/components/ui/primitives";
import { CATEGORIES, type Dataset } from "@/mock/data";
import { cn } from "@/lib/cn";
import { Loadable, useQueryParam } from "./common";
import { ageDays, fmtDate, gb, userById } from "./data";
import { useDatasets, useUsers } from "./state";

type DS = Dataset & { takedown: boolean };
const STATUSES = ["uploading", "processing", "pending_review", "changes_requested", "partially_approved", "approved", "rejected"];
const empty = { user: "", category: "", language: "", kind: "", status: "", period: "", size: "", quality: "", q: "" };

export function useDatasetActions() {
  const { toast, confirm } = useUI();
  const router = useRouter();
  const { patch } = useDatasets();
  return {
    takedown: async (d: DS) => {
      if (!(await confirm({ title: `Take down ${d.id}?`, description: "The dataset is hidden from the platform and marked rejected. Earnings for it are put on hold. This is simulated in the demo.", confirmLabel: "Take down", danger: true }))) return;
      patch(d.id, { status: "rejected", takedown: true }); toast(`${d.id} taken down (demo).`, "info");
    },
    rescan: (d: DS) => toast(`Rescan queued for ${d.id} (simulated).`, "info"),
    message: (d: DS) => router.push(`/admin/messages?compose=${d.ownerId}&dataset=${d.id}`),
    exportOne: (d: DS) => router.push(`/admin/exports?new=1&ids=${d.id}`)
  };
}

export function AdminDatasets() {
  const router = useRouter();
  const { datasets } = useDatasets();
  const { users } = useUsers();
  const actions = useDatasetActions();
  const [userParam] = useQueryParam("user");
  const [f, setF] = useState({ ...empty, user: userParam });
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");
  const [sel, setSel] = useState<string[]>([]);
  const set = (k: keyof typeof empty, v: string) => setF((p) => ({ ...p, [k]: v }));

  const rows = useMemo(() => datasets.filter((d) => {
    if (f.user && d.ownerId !== f.user) return false;
    if (f.category && d.category !== f.category) return false;
    if (f.language && d.language !== f.language) return false;
    if (f.kind && d.kind !== f.kind) return false;
    if (f.status && d.status !== f.status) return false;
    if (f.period && ageDays(d.uploaded) > Number(f.period)) return false;
    if (f.size === "s" && d.sizeGb >= 5) return false;
    if (f.size === "m" && (d.sizeGb < 5 || d.sizeGb > 15)) return false;
    if (f.size === "l" && d.sizeGb <= 15) return false;
    if (f.quality === "unscored" && d.qualityScore !== null) return false;
    if (f.quality === "90" && (d.qualityScore ?? 0) < 90) return false;
    if (f.quality === "70" && (d.qualityScore ?? 0) < 70) return false;
    if (f.quality === "low" && (d.qualityScore === null || d.qualityScore >= 70)) return false;
    if (f.q && !`${d.id} ${d.title} ${d.owner}`.toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  }), [datasets, f]);
  const active = Object.entries(f).filter(([k, v]) => v && k !== "q").length;

  const rowMenu = (d: DS) => (
    <span onClick={(e) => e.stopPropagation()}><Menu label={`Actions for ${d.id}`} items={[
      { label: "View details", onClick: () => router.push(`/admin/datasets/${d.id}`) },
      { label: "Message owner", onClick: () => actions.message(d) },
      { label: "Prepare export", onClick: () => actions.exportOne(d) },
      { label: "Rescan files", onClick: () => actions.rescan(d) },
      ...(d.status === "pending_review" ? [{ label: "Go to review queue", onClick: () => router.push("/admin/reviews") }] : []),
      "sep" as const,
      { label: "Take down", danger: true, disabled: d.takedown, onClick: () => actions.takedown(d) }]} /></span>
  );
  const cols: Column<DS>[] = [
    { key: "t", header: "Dataset", sortValue: (d) => d.title, render: (d) => <div className="min-w-0"><p className="truncate font-medium">{d.title}</p><p className="text-xs text-muted">{d.id} · {d.owner}</p></div> },
    { key: "c", header: "Category", sortValue: (d) => d.category, render: (d) => d.category, hideOnMobile: true },
    { key: "l", header: "Lang", render: (d) => d.language, hideOnMobile: true },
    { key: "k", header: "Type", render: (d) => <Badge tone={d.kind === "labeled" ? "brand" : "neutral"}>{d.kind}</Badge> },
    { key: "s", header: "Size", sortValue: (d) => d.sizeGb, render: (d) => <span className="tabular">{gb(d.sizeGb)}</span> },
    { key: "q", header: "Quality", sortValue: (d) => d.qualityScore ?? -1, render: (d) => <span className="tabular">{d.qualityScore ?? "n/a"}</span>, hideOnMobile: true },
    { key: "st", header: "Status", sortValue: (d) => d.status, render: (d) => <StatusBadge status={d.status} /> },
    { key: "u", header: "Uploaded", sortValue: (d) => d.uploaded, render: (d) => fmtDate(d.uploaded), hideOnMobile: true },
    { key: "a", header: "", className: "w-10", render: rowMenu }
  ];
  const toggleCard = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Loadable>
      <PageHeader title="All datasets" description="Explore every dataset on the platform." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Datasets" }]}
        actions={<Button disabled={sel.length === 0} href={`/admin/exports?new=1&ids=${sel.join(",")}`}>Prepare export{sel.length > 0 && ` (${sel.length})`}</Button>} />
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Search datasets" placeholder="Search id, title or owner…" value={f.q} onChange={(e) => set("q", e.target.value)} className="sm:max-w-xs" />
          <Button variant="outline" onClick={() => setOpen(!open)} aria-expanded={open}><SlidersHorizontal size={14} />Filters{active > 0 && <Badge tone="brand">{active}</Badge>}</Button>
          {active > 0 && <Button variant="ghost" onClick={() => setF({ ...empty, q: f.q })}>Clear filters</Button>}
          <div className="ml-auto flex rounded-lg border border-line p-0.5" role="group" aria-label="View mode">
            {([["table", Rows3, "Table view"], ["cards", LayoutGrid, "Card view"]] as const).map(([v, I, l]) => (
              <button key={v} aria-label={l} aria-pressed={view === v} onClick={() => { setView(v); setSel([]); }} className={cn("rounded-md p-1.5", view === v ? "bg-brand-soft text-brand" : "text-muted hover:text-fg")}><I size={16} /></button>))}
          </div>
        </div>
        {open && (
          <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select aria-label="User" value={f.user} onChange={(e) => set("user", e.target.value)}><option value="">User: all</option>{users.filter((u) => u.roles.includes("Contributor")).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
            <Select aria-label="Category" value={f.category} onChange={(e) => set("category", e.target.value)}><option value="">Category: all</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
            <Select aria-label="Language" value={f.language} onChange={(e) => set("language", e.target.value)}><option value="">Language: all</option><option>Khmer</option><option>English</option></Select>
            <Select aria-label="Type" value={f.kind} onChange={(e) => set("kind", e.target.value)}><option value="">Type: all</option><option value="raw">Raw ($1.00/GB)</option><option value="labeled">Labeled ($1.50/GB)</option></Select>
            <Select aria-label="Status" value={f.status} onChange={(e) => set("status", e.target.value)}><option value="">Status: all</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</Select>
            <Select aria-label="Period" value={f.period} onChange={(e) => set("period", e.target.value)}><option value="">Period: any time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></Select>
            <Select aria-label="Size" value={f.size} onChange={(e) => set("size", e.target.value)}><option value="">Size: any</option><option value="s">Under 5 GB</option><option value="m">5 to 15 GB</option><option value="l">Over 15 GB</option></Select>
            <Select aria-label="Quality" value={f.quality} onChange={(e) => set("quality", e.target.value)}><option value="">Quality: any</option><option value="90">90 and above</option><option value="70">70 and above</option><option value="low">Below 70</option><option value="unscored">Not scored</option></Select>
          </div>
        )}
      </Card>
      {view === "table" ? (
        <DataTable key="t" rows={rows} columns={cols} selectable onSelectionChange={setSel} onRowClick={(d) => router.push(`/admin/datasets/${d.id}`)} pageSize={8} empty={{ title: "No datasets match", description: "Adjust or clear the filters." }} />
      ) : rows.length === 0 ? <Card><EmptyState title="No datasets match" description="Adjust or clear the filters." action={<Button variant="outline" onClick={() => setF(empty)}>Clear filters</Button>} /></Card> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((d) => (
            <Card key={d.id} className={cn("space-y-3 p-4", sel.includes(d.id) && "border-brand")}>
              <div className="flex items-start gap-3">
                <input type="checkbox" aria-label={`Select ${d.id}`} className="mt-1" checked={sel.includes(d.id)} onChange={() => toggleCard(d.id)} />
                <div className="min-w-0 flex-1"><button className="block max-w-full truncate text-left text-sm font-semibold hover:text-brand" onClick={() => router.push(`/admin/datasets/${d.id}`)}>{d.title}</button><p className="text-xs text-muted">{d.id} · {userById(d.ownerId)?.name}</p></div>
                {rowMenu(d)}
              </div>
              <div className="flex flex-wrap gap-1.5"><StatusBadge status={d.status} /><Badge tone={d.kind === "labeled" ? "brand" : "neutral"}>{d.kind}</Badge><Badge>{d.language}</Badge></div>
              <p className="text-xs text-muted">{d.category} · {gb(d.sizeGb)} · {d.files.toLocaleString()} files · quality {d.qualityScore ?? "n/a"}</p>
            </Card>))}
        </div>
      )}
      {view === "cards" && sel.length > 0 && <p className="mt-3 text-xs text-muted">{sel.length} selected</p>}
    </Loadable>
  );
}
