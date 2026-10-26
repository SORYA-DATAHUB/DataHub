import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnotatorFeedback } from "@/features/annotation/annotator-pages";

export const metadata: Metadata = { title: "Annotation feedback" };
export default function Page() { return <Suspense><AnnotatorFeedback /></Suspense>; }
