import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminOverview } from "@/features/admin/overview";

export const metadata: Metadata = { title: "Admin overview · DataHub" };
export default function Page() {
  return <Suspense><AdminOverview /></Suspense>;
}
