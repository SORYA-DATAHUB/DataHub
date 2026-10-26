import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewHistory } from "@/features/annotation/review-pages";

export const metadata: Metadata = { title: "Review history" };
export default function Page() { return <Suspense><ReviewHistory /></Suspense>; }
