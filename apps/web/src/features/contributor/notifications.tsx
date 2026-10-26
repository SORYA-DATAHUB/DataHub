"use client";
import { BellOff, CheckCheck, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, Tabs, useUI } from "@/components/ui/overlays";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useFakeLoad } from "@/lib/demo";
import { N_LABEL, type Notif } from "./data";
import { useForcedState, useNotifs, useQueryParam } from "./hooks";
import { NotifIcon } from "./notif-icon";

export function Notifications() {
  const router = useRouter();
  const loading = useFakeLoad(450);
  const { toast } = useUI();
  const { forced, clear } = useForcedState();
  const [list, setList] = useNotifs();
  const [f, setF] = useQueryParam("filter", "all");
  const filter = f === "unread" ? "unread" : "all";
  const unread = list.filter((n) => !n.read).length;
  const rows = forced === "empty" ? [] : filter === "unread" ? list.filter((n) => !n.read) : list;
  const setRead = (id: string, read: boolean) => setList((p) => p.map((n) => (n.id === id ? { ...n, read } : n)));
  const open = (n: Notif) => { setRead(n.id, true); router.push(n.href); };

  return (
    <>
      <PageHeader title="Notifications" description="Reviews, earnings, withdrawals and messages."
        actions={<Button variant="outline" disabled={unread === 0} onClick={() => { setList((p) => p.map((n) => ({ ...n, read: true }))); toast("All notifications marked as read."); }}><CheckCheck size={14} />Mark all as read</Button>} />
      <Card>
        <div className="px-3"><Tabs tabs={[{ id: "all", label: "All", count: list.length }, { id: "unread", label: "Unread", count: unread }]} value={filter} onChange={(v) => setF(v)} /></div>
        {forced === "error" ? <ErrorState onRetry={clear} />
          : loading ? <div className="space-y-3 p-4" aria-busy="true">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
          : rows.length === 0 ? <EmptyState icon={BellOff} title={filter === "unread" ? "You are all caught up" : "No notifications yet"} description={filter === "unread" ? "No unread notifications." : "Updates about your datasets and payouts will show up here."} action={filter === "unread" && <Button variant="outline" onClick={() => setF("all")}>Show all</Button>} />
          : (
            <ul className="divide-y divide-line">{rows.map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface2/40">
                <NotifIcon type={n.type} />
                <button className="min-w-0 flex-1 text-left" onClick={() => open(n)}>
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">{n.title}<Badge>{N_LABEL[n.type]}</Badge>{!n.read && <Circle size={8} className="fill-brand text-brand" aria-label="Unread" />}</span>
                  <span className="block text-sm text-muted">{n.body}</span><span className="text-xs text-muted">{n.time}</span>
                </button>
                <Menu label={`Actions for ${n.title}`} items={[{ label: "Open", onClick: () => open(n) }, { label: n.read ? "Mark as unread" : "Mark as read", onClick: () => setRead(n.id, !n.read) }]} />
              </li>))}</ul>
          )}
      </Card>
    </>
  );
}
