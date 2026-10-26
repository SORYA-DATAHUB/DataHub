import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewDashboard } from "@/features/annotation/review-pages";

export const metadata: Metadata = { title: "Review" };
export default function Page() { return <Suspense><ReviewDashboard /></Suspense>; }
