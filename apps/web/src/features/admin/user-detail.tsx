"use client";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { notFound, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, Tabs, useUI } from "@/components/ui/overlays";
import { Alert, Avatar, Badge, Card, CardHeader, EmptyState, PageHeader, Stat, StatusBadge, Textarea } from "@/components/ui/primitives";
import { payouts } from "@/mock/data";
import Link from "next/link";
import { Loadable, useQueryParam } from "./common";
import { fmtDate, gb, PERMISSIONS, ROLE_MATRIX, usd, verificationsSeed } from "./data";
import { useDatasets, useUserNotes, useUsers } from "./state";
import { RolesDialog } from "./users-table";

const TABS = ["overview", "datasets", "finance", "roles", "sessions", "activity"] as const;
type Tab = (typeof TABS)[number];

const sessionsSeed = [
  { id: "s1", device: "Chrome on Windows", ip: "203.0.113.41", place: "Phnom Penh, KH", last: "Active now" },
  { id: "s2", device: "Safari on iPhone", ip: "203.0.113.88", place: "Phnom Penh, KH", last: "2 h ago" },
  { id: "s3", device: "Firefox on Linux", ip: "198.51.100.12", place: "Siem Reap, KH", last: "6 days ago" }
];

export function AdminUserDetail({ id }: { id: string }) {
  const { users } = useUsers();
  const user = users.find((u) => u.id === id);
  if (!user) notFound();
  return <Loadable><Inner id={id} /></Loadable>;
}

function Inner({ id }: { id: string }) {
  const router = useRouter();
  const { toast, confirm } = useUI();
  const { users, patch } = useUsers();
  const { datasets } = useDatasets();
  const user = users.find((u) => u.id === id)!;
  const [tabRaw, setTab] = useQueryParam("tab", "overview");
  const tab = (TABS as readonly string[]).includes(tabRaw) ? (tabRaw as Tab) : "overview";
  const { notes, add } = useUserNotes(id);
  const [note, setNote] = useState("");
  const [noteErr, setNoteErr] = useState("");
  const [rolesOpen, setRolesOpen] = useState(false);
  const [revoked, setRevoked] = useState<string[]>([]);
  const mine = datasets.filter((d) => d.ownerId === id);
  const myPayouts = payouts.filter((p) => p.userId === id);
  const ver = verificationsSeed.filter((v) => v.userId === id);
  const perms = PERMISSIONS.filter((p) => user.roles.some((r) => ROLE_MATRIX[r]?.includes(p)));
  const reviewed = mine.filter((d) => d.qualityScore !== null);
  const avgQ = reviewed.length ? Math.round(reviewed.reduce((a, d) => a + (d.qualityScore ?? 0), 0) / reviewed.length) : null;

  const toggleSuspend = async () => {
    const susp = user.status === "active";
    if (!(await confirm({ title: susp ? `Suspend ${user.name}?` : `Reactivate ${user.name}?`, description: susp ? "They will be signed out of all sessions and blocked from uploads and payouts." : "They will regain access.", confirmLabel: susp ? "Suspend" : "Reactivate", danger: susp }))) return;
    patch(id, { status: susp ? "suspended" : "active" });
    toast(susp ? "Account suspended (demo)." : "Account reactivated (demo).");
  };
  const addNote = () => {
    if (note.trim().length < 3) { setNoteErr("Write at least 3 characters."); return; }
    add(note.trim()); setNote(""); setNoteErr(""); toast("Admin note saved.");
  };

  return (
    <>
      <PageHeader title={user.name} description={`${user.email} · ${user.country} · joined ${fmtDate(user.joined)}`}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Users", href: "/admin/users" }, { label: user.name }]}
        actions={<>
          <Button variant="outline" href={`/admin/messages?compose=${id}`}><MessageSquare size={14} />Message</Button>
          <Button variant={user.status === "active" ? "danger" : "primary"} onClick={toggleSuspend}>{user.status === "active" ? "Suspend" : "Reactivate"}</Button>
          <Menu label="More actions" items={[
            { label: "Approve eligibility", disabled: user.verification === "verified", onClick: () => { patch(id, { verification: "verified" }); toast("Marked verified and eligible (demo)."); } },
            { label: "Assign roles", onClick: () => setRolesOpen(true) },
            { label: "Review submissions", onClick: () => router.push(`/admin/datasets?user=${id}`) }]} />
        </>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Avatar name={user.name} size={36} /><StatusBadge status={user.status} /><StatusBadge status={user.verification} />{user.roles.map((r) => <Badge key={r} tone="brand">{r}</Badge>)}
      </div>
      {user.status === "suspended" && <div className="mb-4"><Alert tone="danger" title="This account is suspended">Uploads, annotation and payouts are blocked. Reactivate to restore access.</Alert></div>}
      <Tabs tabs={TABS.map((t) => ({ id: t, label: t[0].toUpperCase() + t.slice(1) }))} value={tab} onChange={setTab} />
      <div className="mt-5" role="tabpanel">
        {tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Uploads" value={user.uploads} /><Stat label="Accepted" value={gb(user.acceptedGb)} tone="success" />
                <Stat label="Earnings" value={usd(user.earnings)} tone="success" /><Stat label="Review quality" value={avgQ === null ? "n/a" : `${avgQ}%`} hint="Average quality score" />
              </div>
              <Card><CardHeader title="Verification history" />
                {ver.length === 0 ? <EmptyState icon={ShieldCheck} title="No verification submitted" description="This user has not submitted an ID document." /> :
                  <ul className="divide-y divide-line">{ver.map((v) => (
                    <li key={v.id} className="space-y-1 px-5 py-3 text-sm"><div className="flex items-center justify-between"><span className="font-medium">{v.id} · {v.docType}</span><StatusBadge status={v.status} /></div>
                      {v.history.map((h, i) => <p key={i} className="text-xs text-muted">{fmtDate(h.at)}: {h.text}</p>)}
                      {v.status === "pending" && <Link href={`/admin/verifications?case=${v.id}`} className="text-xs text-brand hover:underline">Open case</Link>}</li>))}</ul>}
              </Card>
            </div>
            <Card><CardHeader title="Admin notes" description="Internal only. Never shown to the user." />
              <div className="space-y-3 p-4">
                <Textarea aria-label="New admin note" aria-invalid={!!noteErr} placeholder="Add an internal note…" value={note} onChange={(e) => { setNote(e.target.value); setNoteErr(""); }} />
                {noteErr && <p role="alert" className="text-xs text-danger">{noteErr}</p>}
                <Button size="sm" onClick={addNote}>Save note</Button>
                {notes.length === 0 ? <p className="text-sm text-muted">No notes yet.</p> : <ul className="space-y-2">{notes.map((n) => <li key={n.id} className="rounded-lg bg-surface2 p-3 text-sm"><p>{n.text}</p><p className="mt-1 text-xs text-muted">Anna Keller · {fmtDate(n.at)}</p></li>)}</ul>}
              </div>
            </Card>
          </div>
        )}
        {tab === "datasets" && (mine.length === 0 ? <Card><EmptyState title="No datasets" description="This user has not uploaded any datasets." /></Card> :
          <Card><ul className="divide-y divide-line">{mine.map((d) => (
            <li key={d.id}><Link href={`/admin/datasets/${d.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface2/50">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.title}</p><p className="text-xs text-muted">{d.id} · {d.category} · {gb(d.sizeGb)} · accepted {gb(d.acceptedGb)}</p></div>
              <StatusBadge status={d.status} /></Link></li>))}</ul></Card>)}
        {tab === "finance" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat label="Lifetime earnings" value={usd(user.earnings)} tone="success" /><Stat label="Paid out" value={usd(myPayouts.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0))} />
              <Stat label="Pending payouts" value={usd(myPayouts.filter((p) => ["requested", "under_review", "approved"].includes(p.status)).reduce((a, p) => a + p.amount, 0))} tone="warning" />
            </div>
            <Card><CardHeader title="Payouts" action={<Button variant="ghost" size="sm" href="/admin/payouts">All payouts</Button>} />
              {myPayouts.length === 0 ? <EmptyState title="No payouts" description="No payout requests from this user." /> :
                <ul className="divide-y divide-line">{myPayouts.map((p) => (<li key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm"><div className="min-w-0 flex-1"><p className="font-medium">{p.id} · {usd(p.amount)}</p><p className="text-xs text-muted">{p.method} · {fmtDate(p.requested)}</p></div><StatusBadge status={p.status} /></li>))}</ul>}
            </Card>
          </div>
        )}
        {tab === "roles" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader title="Roles" action={<Button size="sm" onClick={() => setRolesOpen(true)}>Assign roles</Button>} />
              <div className="flex flex-wrap gap-2 p-5">{user.roles.map((r) => <Badge key={r} tone="brand">{r}</Badge>)}</div></Card>
            <Card><CardHeader title="Effective permissions" description="Derived from assigned roles" />
              <ul className="divide-y divide-line">{PERMISSIONS.map((p) => <li key={p} className="flex items-center justify-between px-5 py-2.5 text-sm"><span>{p}</span>{perms.includes(p) ? <Badge tone="success">Granted</Badge> : <Badge>No</Badge>}</li>)}</ul></Card>
          </div>
        )}
        {tab === "sessions" && (
          <Card><CardHeader title="Active sessions" action={<Button variant="outline" size="sm" onClick={async () => { if (await confirm({ title: "Revoke all sessions?", description: "The user will be signed out on every device.", confirmLabel: "Revoke all", danger: true })) { setRevoked(sessionsSeed.map((s) => s.id)); toast("All sessions revoked (demo)."); } }}>Revoke all</Button>} />
            {sessionsSeed.every((s) => revoked.includes(s.id)) ? <EmptyState title="No active sessions" description="All sessions were revoked." /> :
              <ul className="divide-y divide-line">{sessionsSeed.filter((s) => !revoked.includes(s.id)).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"><div className="min-w-0 flex-1"><p className="font-medium">{s.device}</p><p className="text-xs text-muted">{s.ip} · {s.place} · {s.last}</p></div>
                  <Button variant="outline" size="sm" onClick={async () => { if (await confirm({ title: "Revoke this session?", description: s.device, confirmLabel: "Revoke", danger: true })) { setRevoked((r) => [...r, s.id]); toast("Session revoked (demo)."); } }}>Revoke</Button></li>))}</ul>}
          </Card>
        )}
        {tab === "activity" && (
          <Card><CardHeader title="Recent activity" />
            <ol className="space-y-4 p-5">{[
              ["Today 09:12", "Signed in from Phnom Penh"], ["Oct 24", `Requested payout${myPayouts[0] ? ` ${myPayouts[0].id}` : ""}`],
              ["Oct 22", mine[0] ? `Uploaded ${mine[0].id}` : "Updated profile"], ["Oct 19", "Changed notification settings"], [fmtDate(user.joined), "Account created"]].map(([t, x]) => (
              <li key={t + x} className="flex gap-3 text-sm"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" /><div><p>{x}</p><p className="text-xs text-muted">{t}</p></div></li>))}</ol>
          </Card>
        )}
      </div>
      <RolesDialog user={user} open={rolesOpen} onClose={() => setRolesOpen(false)} onSave={(roles) => { patch(id, { roles }); setRolesOpen(false); toast("Roles updated (demo)."); }} />
    </>
  );
}
