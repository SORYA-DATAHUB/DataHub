import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnotationComparison } from "@/features/annotation/review-compare";

export const metadata: Metadata = { title: "Annotation review" };
export default async function Page({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <Suspense><AnnotationComparison taskId={taskId} /></Suspense>;
}
