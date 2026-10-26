import type { Metadata } from "next";
import { Suspense } from "react";
import { MyTasks } from "@/features/annotation/annotator-pages";

export const metadata: Metadata = { title: "My tasks" };
export default function Page() { return <Suspense><MyTasks /></Suspense>; }
