import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectWizard } from "@/features/annotation/project-wizard";

export const metadata: Metadata = { title: "New annotation project" };
export default function Page() { return <Suspense><ProjectWizard /></Suspense>; }
