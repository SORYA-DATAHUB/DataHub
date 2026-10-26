import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnotatorEarnings } from "@/features/annotation/annotator-pages";

export const metadata: Metadata = { title: "Annotation earnings" };
export default function Page() { return <Suspense><AnnotatorEarnings /></Suspense>; }
