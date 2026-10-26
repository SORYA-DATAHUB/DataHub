import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnotationQueue } from "@/features/annotation/annotation-queue";

export const metadata: Metadata = { title: "Annotation review queue" };
export default function Page() { return <Suspense><AnnotationQueue admin /></Suspense>; }
