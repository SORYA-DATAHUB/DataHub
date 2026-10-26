"use client";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, SearchX } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Card, EmptyState, Input, Select, Skeleton } from "./primitives";

export type Column<T> = { key: string; header: string; sortValue?: (r: T) => string | number; render: (r: T) => ReactNode; className?: string; hideOnMobile?: boolean };

/** Searchable, sortable, filterable, paginated table with bulk selection and a mobile card fallback. */
export function DataTable<T extends { id: string }>({ rows, columns, searchText, filters, pageSize = 8, toolbar, selectable, onSelectionChange, empty, loading, onRowClick }: {
  rows: T[]; columns: Column<T>[]; searchText?: (r: T) => string; pageSize?: number; toolbar?: ReactNode; selectable?: boolean; loading?: boolean;
  filters?: Array<{ label: string; options: string[]; predicate: (r: T, v: string) => boolean }>;
  onSelectionChange?: (ids: string[]) => void; onRowClick?: (r: T) => void; empty?: { title: string; description?: string };
}) {
  const [q, setQ] = useState("");
  const [fv, setFv] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const view = useMemo(() => {
    let r = rows;
    if (q && searchText) r = r.filter((x) => searchText(x).toLowerCase().includes(q.toLowerCase()));
    filters?.forEach((f) => { const v = fv[f.label]; if (v && v !== "All") r = r.filter((x) => f.predicate(x, v)); });
    const col = columns.find((c) => c.key === sort?.key);
    if (col?.sortValue && sort) r = [...r].sort((a, b) => { const x = col.sortValue!(a), y = col.sortValue!(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
    return r;
  }, [rows, q, fv, sort, columns, searchText, filters]);
  const pages = Math.max(1, Math.ceil(view.length / pageSize));
  const cur = Math.min(page, pages);
  const slice = view.slice((cur - 1) * pageSize, cur * pageSize);
  const toggle = (id: string) => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); setSel(n); onSelectionChange?.([...n]); };
  const toggleAll = () => { const n = slice.every((r) => sel.has(r.id)) ? new Set<string>() : new Set(slice.map((r) => r.id)); setSel(n); onSelectionChange?.([...n]); };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        {searchText && (
          <div className="relative min-w-48 flex-1 sm:max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <Input aria-label="Search" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-8" /></div>
        )}
        {filters?.map((f) => (
          <Select key={f.label} aria-label={f.label} className="w-auto" value={fv[f.label] ?? "All"} onChange={(e) => { setFv({ ...fv, [f.label]: e.target.value }); setPage(1); }}>
            {["All", ...f.options].map((o) => <option key={o} value={o}>{o === "All" ? `${f.label}: All` : o}</option>)}
          </Select>
        ))}
        <div className="ml-auto flex items-center gap-2">{sel.size > 0 && <span className="text-xs text-muted">{sel.size} selected</span>}{toolbar}</div>
      </div>
      {loading ? <div className="space-y-3 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
        : slice.length === 0 ? <EmptyState icon={SearchX} title={empty?.title ?? "No results"} description={empty?.description ?? "Try adjusting your search or filters."} action={(q || Object.keys(fv).length > 0) && <Button variant="outline" onClick={() => { setQ(""); setFv({}); }}>Clear filters</Button>} />
        : (<>
          <div className="scroll-thin hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface2/60 text-xs text-muted"><tr>
                {selectable && <th className="w-10 px-4 py-2.5"><input type="checkbox" aria-label="Select all on page" checked={slice.every((r) => sel.has(r.id))} onChange={toggleAll} /></th>}
                {columns.map((c) => (
                  <th key={c.key} className={cn("whitespace-nowrap px-4 py-2.5 font-medium", c.className)} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                    {c.sortValue ? <button className="inline-flex items-center gap-1 hover:text-fg" onClick={() => setSort(sort?.key === c.key ? (sort.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 })}>
                      {c.header}{sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</button> : c.header}
                  </th>))}
              </tr></thead>
              <tbody className="divide-y divide-line">
                {slice.map((r) => (
                  <tr key={r.id} onClick={() => onRowClick?.(r)} className={cn("hover:bg-surface2/50", onRowClick && "cursor-pointer", sel.has(r.id) && "bg-brand-soft/50")}>
                    {selectable && <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.id}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>}
                    {columns.map((c) => <td key={c.key} className={cn("px-4 py-3", c.className)}>{c.render(r)}</td>)}
                  </tr>))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-line md:hidden">
            {slice.map((r) => (
              <li key={r.id} className="space-y-1.5 p-4" onClick={() => onRowClick?.(r)}>
                {columns.filter((c) => !c.hideOnMobile).map((c, i) => <div key={c.key} className={cn("flex items-start justify-between gap-3", i === 0 && "font-medium")}>{i > 0 && <span className="text-xs text-muted">{c.header}</span>}<span className="min-w-0 text-right first:text-left">{c.render(r)}</span></div>)}
              </li>))}
          </ul>
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
            <span>{view.length} result{view.length === 1 ? "" : "s"} · page {cur} of {pages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft size={14} /></Button>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight size={14} /></Button>
            </div>
          </div>
        </>)}
    </Card>
  );
}
