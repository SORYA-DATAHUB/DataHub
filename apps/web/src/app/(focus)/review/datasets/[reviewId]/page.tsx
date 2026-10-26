import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { reviewById } from "@/features/admin/data";
import { ReviewWorkspace } from "@/features/admin/review-workspace";

export const metadata: Metadata = { title: "Dataset review · DataHub" };
export default async function Page({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  if (!reviewById(reviewId)) notFound();
  return <Suspense><ReviewWorkspace reviewId={reviewId} /></Suspense>;
}
