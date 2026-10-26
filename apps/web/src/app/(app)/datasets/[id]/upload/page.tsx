import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UploadResume } from "@/features/contributor/upload-resume";

export const metadata: Metadata = { title: "Upload progress" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^DS-\d{4,}$/.test(id)) notFound();
  return <Suspense><UploadResume id={id} /></Suspense>;
}
