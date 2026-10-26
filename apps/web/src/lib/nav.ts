import { Banknote, BarChart3, Bell, BookOpenCheck, ClipboardCheck, Database, Download, FilePlus2, FolderKanban, History, LayoutDashboard, ListChecks, MessageSquare, ScrollText, Settings, ShieldCheck, Tags, User, Users, Wallet, type LucideIcon } from "lucide-react";

export type Workspace = "contribute" | "annotate" | "review" | "admin";
export type NavItem = { label: string; href: string; icon: LucideIcon; exact?: boolean };
export const WORKSPACES: Record<Workspace, { label: string; home: string; role: string }> = {
  contribute: { label: "Contribute", home: "/dashboard", role: "Contributor" },
  annotate: { label: "Annotate", home: "/annotate", role: "Annotator" },
  review: { label: "Review", home: "/review", role: "Reviewer" },
  admin: { label: "Admin", home: "/admin", role: "Administrator" }
};
const personal: NavItem[] = [
  { label: "Withdrawals", href: "/withdrawals", icon: Wallet },
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings }
];
export const NAV: Record<Workspace, Array<{ title?: string; items: NavItem[] }>> = {
  contribute: [{ items: [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "Upload dataset", href: "/datasets/new", icon: FilePlus2 },
    { label: "My datasets", href: "/datasets", icon: Database },
    { label: "Earnings", href: "/earnings", icon: Banknote }] }, { title: "Account", items: personal }],
  annotate: [{ items: [
    { label: "Overview", href: "/annotate", icon: LayoutDashboard, exact: true },
    { label: "My tasks", href: "/annotate/tasks", icon: ListChecks },
    { label: "Submitted", href: "/annotate/submitted", icon: ClipboardCheck },
    { label: "Feedback", href: "/annotate/feedback", icon: MessageSquare },
    { label: "Earnings", href: "/annotate/earnings", icon: Banknote }] }, { title: "Account", items: personal }],
  review: [{ items: [
    { label: "Overview", href: "/review", icon: LayoutDashboard, exact: true },
    { label: "Dataset reviews", href: "/review/datasets", icon: BookOpenCheck },
    { label: "Annotation reviews", href: "/review/annotations", icon: Tags },
    { label: "History", href: "/review/history", icon: History }] }, { title: "Account", items: personal.slice(1) }],
  admin: [
    { items: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Verifications", href: "/admin/verifications", icon: ShieldCheck },
      { label: "All datasets", href: "/admin/datasets", icon: Database },
      { label: "Review queue", href: "/admin/reviews", icon: BookOpenCheck }] },
    { title: "Annotation", items: [
      { label: "Projects", href: "/admin/annotation/projects", icon: FolderKanban },
      { label: "Assignments", href: "/admin/annotation/assignments", icon: ListChecks },
      { label: "Annotation reviews", href: "/admin/annotation/reviews", icon: Tags }] },
    { title: "Finance", items: [
      { label: "Payments", href: "/admin/finance", icon: Banknote },
      { label: "Payout requests", href: "/admin/payouts", icon: Wallet },
      { label: "Pricing", href: "/admin/pricing", icon: Banknote }] },
    { title: "Operations", items: [
      { label: "Messages", href: "/admin/messages", icon: MessageSquare },
      { label: "Exports", href: "/admin/exports", icon: Download },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Audit logs", href: "/admin/audit-logs", icon: ScrollText },
      { label: "Settings", href: "/admin/settings", icon: Settings }] }
  ]
};
export function workspaceFor(path: string): Workspace {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/annotate")) return "annotate";
  if (path.startsWith("/review")) return "review";
  return "contribute";
}
