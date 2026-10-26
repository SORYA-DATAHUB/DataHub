import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminDatasetDetail } from "@/features/admin/dataset-detail";

export const metadata: Metadata = { title: "Dataset · Admin · DataHub" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense><AdminDatasetDetail id={id} /></Suspense>;
}
