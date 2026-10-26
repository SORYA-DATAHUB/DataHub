import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmittedTasks } from "@/features/annotation/annotator-pages";

export const metadata: Metadata = { title: "Submitted tasks" };
export default function Page() { return <Suspense><SubmittedTasks /></Suspense>; }
