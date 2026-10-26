import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAuditLogs } from "@/features/admin/audit-logs";

export const metadata: Metadata = { title: "Audit logs · Admin · DataHub" };
export default function Page() {
  return <Suspense><AdminAuditLogs /></Suspense>;
}
