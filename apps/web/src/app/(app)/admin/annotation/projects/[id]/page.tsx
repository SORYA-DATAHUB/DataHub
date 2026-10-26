import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectDetail } from "@/features/annotation/project-detail";

export const metadata: Metadata = { title: "Annotation project" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense><ProjectDetail id={id} /></Suspense>;
}
