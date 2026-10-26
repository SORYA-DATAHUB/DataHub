"use client";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { Drawer, Tabs } from "@/components/ui/overlays";
import { Alert, Badge, Card, DeniedState, PageHeader, Select, StatusBadge } from "@/components/ui/primitives";
import { useDemoState } from "@/lib/demo";
import { useState } from "react";
import { KV, Loadable, useQueryParam } from "./common";
import { auditSeed, type AuditEntry } from "./data";

export function AdminAuditLogs() {
  const [tabRaw, setTab] = useQueryParam("tab", "audit");
  const tab = tabRaw === "security" ? "security" : "audit";
  const [role, setRole] = useDemoState<"Super Administrator" | "Administrator">("admin-role-preview", "Super Administrator");
  const [open, setOpen] = useState<AuditEntry | null>(null);
  const rows = auditSeed.filter((a) => a.kind === tab);
  const actors = [...new Set(auditSeed.map((a) => a.actor))];

  const cols: Column<AuditEntry>[] = [
    { key: "at", header: "Time (UTC)", sortValue: (a) => a.at, render: (a) => <span className="tabular whitespace-nowrap">{a.at}</span> },
    { key: "actor", header: "Actor", sortValue: (a) => a.actor, render: (a) => a.actor },
    { key: "action", header: "Action", sortValue: (a) => a.action, render: (a) => <code className="rounded bg-surface2 px-1.5 py-0.5 text-xs">{a.action}</code> },
    { key: "entity", header: "Entity", render: (a) => a.entity, hideOnMobile: true },
    { key: "ip", header: "IP", render: (a) => <span className="font-mono text-xs">{a.ip}</span>, hideOnMobile: true },
    { key: "res", header: "Result", sortValue: (a) => a.result, render: (a) => <StatusBadge status={a.result} /> }
  ];
  return (
    <Loadable role="Super Administrator">
      <PageHeader title="Audit logs" description="Immutable record of administrative and security events." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Audit logs" }]}
        actions={<label className="flex items-center gap-2 text-xs text-muted">Demo: view as
          <Select aria-label="View as role" className="w-44" value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option>Super Administrator</option><option>Administrator</option></Select></label>} />
      {role !== "Super Administrator" ? <Card><DeniedState role="Super Administrator" /></Card> : (
        <>
          <div className="mb-4"><Alert tone="info" title="Super Administrator access"><span className="inline-flex items-center gap-1.5"><ShieldAlert size={14} />Audit logs are visible to super administrators only. Entries cannot be edited or deleted.</span></Alert></div>
          <Tabs tabs={[{ id: "audit", label: "Audit trail", count: auditSeed.filter((a) => a.kind === "audit").length }, { id: "security", label: "Security events", count: auditSeed.filter((a) => a.kind === "security").length }]} value={tab} onChange={setTab} />
          <div className="mt-4">
            <DataTable key={tab} rows={rows} columns={cols} pageSize={8} searchText={(a) => `${a.actor} ${a.action} ${a.entity} ${a.ip}`} onRowClick={setOpen}
              filters={[{ label: "Actor", options: actors, predicate: (a, v) => a.actor === v }, { label: "Result", options: ["success", "denied"], predicate: (a, v) => a.result === v }]}
              empty={{ title: "No log entries", description: "Nothing matches the current filters." }} />
          </div>
        </>
      )}
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.id ?? "Entry"} description={open?.action}>
        {open && <div className="space-y-4">
          <dl className="divide-y divide-line rounded-lg border border-line px-4"><KV k="Time" v={open.at} /><KV k="Actor" v={open.actor} /><KV k="Entity" v={open.entity} /><KV k="IP address" v={open.ip} /><KV k="Result" v={<StatusBadge status={open.result} />} /><KV k="Category" v={<Badge>{open.kind}</Badge>} /></dl>
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Change detail</p><pre className="whitespace-pre-wrap rounded-lg bg-surface2 p-3 font-mono text-xs">{open.detail}</pre></div>
          <Button variant="outline" onClick={() => setOpen(null)}>Close</Button>
        </div>}
      </Drawer>
    </Loadable>
  );
}
