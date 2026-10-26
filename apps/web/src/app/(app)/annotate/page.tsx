import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnotatorDashboard } from "@/features/annotation/annotator-pages";

export const metadata: Metadata = { title: "Annotate" };
export default function Page() { return <Suspense><AnnotatorDashboard /></Suspense>; }
