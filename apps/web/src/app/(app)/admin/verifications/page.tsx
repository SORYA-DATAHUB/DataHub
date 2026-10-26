import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminVerifications } from "@/features/admin/verifications";

export const metadata: Metadata = { title: "Verifications · Admin · DataHub" };
export default function Page() {
  return <Suspense><AdminVerifications /></Suspense>;
}
