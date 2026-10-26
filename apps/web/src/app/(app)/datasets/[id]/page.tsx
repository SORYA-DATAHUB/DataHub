import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DatasetDetail } from "@/features/contributor/dataset-detail";

export const metadata: Metadata = { title: "Dataset details" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^DS-\d{4,}$/.test(id)) notFound();
  return <Suspense><DatasetDetail id={id} /></Suspense>;
}
