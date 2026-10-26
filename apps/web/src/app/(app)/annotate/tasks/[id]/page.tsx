import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskDetails } from "@/features/annotation/annotator-pages";

export const metadata: Metadata = { title: "Task details" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense><TaskDetails id={id} /></Suspense>;
}
