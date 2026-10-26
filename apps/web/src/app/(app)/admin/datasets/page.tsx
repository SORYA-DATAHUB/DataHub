import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminDatasets } from "@/features/admin/datasets-explorer";

export const metadata: Metadata = { title: "Datasets · Admin · DataHub" };
export default function Page() {
  return <Suspense><AdminDatasets /></Suspense>;
}
