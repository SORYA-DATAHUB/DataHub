"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Column, DataTable } from "@/components/ui/data-table";
import { Menu, Modal, useUI } from "@/components/ui/overlays";
import { Avatar, Badge, PageHeader, StatusBadge } from "@/components/ui/primitives";
import type { User } from "@/mock/data";
import { Loadable } from "./common";
import { fmtDate, gb, ROLES, usd } from "./data";
import { useUsers } from "./state";

export function RolesDialog({ user, open, onClose, onSave }: { user: User | null; open: boolean; onClose: () => void; onSave: (roles: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const [key, setKey] = useState("");
  if (open && user && key !== user.id) { setKey(user.id); setSel(user.roles); }
  if (!open && key) setKey("");
  const toggle = (r: string) => setSel((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));
  const err = sel.length === 0 ? "Select at least one role." : sel.includes("Super Administrator") && !user?.roles.includes("Super Administrator") ? "Only a Super Administrator can grant this role (simulated warning)." : "";
  return (
    <Modal open={open} onClose={onClose} title={`Assign roles${user ? `: ${user.name}` : ""}`} description="Admin roles are granted by super administrators only."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={sel.length === 0} onClick={() => onSave(sel)}>Save roles</Button></>}>
      <fieldset className="space-y-2"><legend className="sr-only">Roles</legend>
        {ROLES.map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 text-sm hover:bg-surface2">
            <input type="checkbox" checked={sel.includes(r)} onChange={() => toggle(r)} /> {r}
          </label>
        ))}
      </fieldset>
      {err && <p role="alert" className="mt-3 text-xs text-warning">{err}</p>}
    </Modal>
  );
}

export function AdminUsers() {
  const router = useRouter();
  const { toast, confirm } = useUI();
  const { users, patch } = useUsers();
  const [rolesFor, setRolesFor] = useState<User | null>(null);

  const suspend = async (u: User) => {
    const susp = u.status === "active";
    const ok = await confirm({ title: susp ? `Suspend ${u.name}?` : `Reactivate ${u.name}?`, description: susp ? "They will be signed out and unable to upload or request payouts until reactivated." : "They will regain access to their account.", confirmLabel: susp ? "Suspend" : "Reactivate", danger: susp });
    if (!ok) return;
    patch(u.id, { status: susp ? "suspended" : "active" });
    toast(susp ? `${u.name} suspended (demo).` : `${u.name} reactivated (demo).`, susp ? "info" : "success");
  };

  const cols: Column<User>[] = [
    { key: "name", header: "User", sortValue: (u) => u.name, render: (u) => (
      <div className="flex min-w-0 items-center gap-3"><Avatar name={u.name} size={32} /><div className="min-w-0"><p className="truncate font-medium">{u.name}</p><p className="truncate text-xs text-muted">{u.email}</p></div></div>) },
    { key: "roles", header: "Roles", render: (u) => <div className="flex flex-wrap justify-end gap-1 md:justify-start">{u.roles.map((r) => <Badge key={r} tone={r.includes("Admin") ? "brand" : "neutral"}>{r}</Badge>)}</div> },
    { key: "ver", header: "Verification", sortValue: (u) => u.verification, render: (u) => <StatusBadge status={u.verification} /> },
    { key: "status", header: "Status", sortValue: (u) => u.status, render: (u) => <StatusBadge status={u.status} /> },
    { key: "uploads", header: "Uploads", sortValue: (u) => u.uploads, render: (u) => <span className="tabular">{u.uploads}</span>, hideOnMobile: true },
    { key: "acc", header: "Accepted", sortValue: (u) => u.acceptedGb, render: (u) => <span className="tabular">{gb(u.acceptedGb)}</span>, hideOnMobile: true },
    { key: "earn", header: "Earnings", sortValue: (u) => u.earnings, render: (u) => <span className="tabular">{usd(u.earnings)}</span> },
    { key: "joined", header: "Joined", sortValue: (u) => u.joined, render: (u) => fmtDate(u.joined), hideOnMobile: true },
    { key: "act", header: "", className: "w-10", render: (u) => (
      <span onClick={(e) => e.stopPropagation()}><Menu label={`Actions for ${u.name}`} items={[
        { label: "View profile", onClick: () => router.push(`/admin/users/${u.id}`) },
        { label: "Approve eligibility", disabled: u.verification === "verified", onClick: () => { patch(u.id, { verification: "verified" }); toast(`${u.name} marked verified and eligible (demo).`); } },
        { label: "Assign roles", onClick: () => setRolesFor(u) },
        { label: "Review submissions", onClick: () => router.push(`/admin/datasets?user=${u.id}`) },
        { label: "Transactions", onClick: () => router.push(`/admin/users/${u.id}?tab=finance`) },
        { label: "Send message", onClick: () => router.push(`/admin/messages?compose=${u.id}`) },
        "sep",
        { label: u.status === "active" ? "Suspend" : "Reactivate", danger: u.status === "active", onClick: () => suspend(u) }]} /></span>) }
  ];

  return (
    <Loadable>
      <PageHeader title="Users" description="Manage contributors, annotators, reviewers and administrators." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Users" }]}
        actions={<Button variant="outline" onClick={() => toast("Invitation flow is not part of the demo.", "info")}>Invite user</Button>} />
      <DataTable rows={users} columns={cols} pageSize={8} searchText={(u) => `${u.name} ${u.email} ${u.country}`} onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
        filters={[
          { label: "Role", options: [...ROLES], predicate: (u, v) => u.roles.includes(v) },
          { label: "Status", options: ["active", "suspended"], predicate: (u, v) => u.status === v },
          { label: "Verification", options: ["verified", "pending", "unverified"], predicate: (u, v) => u.verification === v }]} />
      <RolesDialog user={rolesFor} open={!!rolesFor} onClose={() => setRolesFor(null)} onSave={(roles) => { if (rolesFor) { patch(rolesFor.id, { roles }); toast(`Roles updated for ${rolesFor.name} (demo).`); } setRolesFor(null); }} />
    </Loadable>
  );
}
