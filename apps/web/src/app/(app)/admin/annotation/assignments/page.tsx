import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAssignments } from "@/features/annotation/admin-assignments";

export const metadata: Metadata = { title: "Annotation assignments" };
export default function Page() { return <Suspense><AdminAssignments /></Suspense>; }
