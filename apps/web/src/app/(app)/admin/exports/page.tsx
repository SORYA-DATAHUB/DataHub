import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminExports } from "@/features/admin/exports";

export const metadata: Metadata = { title: "Exports · Admin · DataHub" };
export default function Page() {
  return <Suspense><AdminExports /></Suspense>;
}
