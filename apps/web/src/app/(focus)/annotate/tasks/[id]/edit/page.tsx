import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnotationEditor } from "@/features/annotation/editor";

export const metadata: Metadata = { title: "Annotation editor" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense><AnnotationEditor taskId={id} /></Suspense>;
}
