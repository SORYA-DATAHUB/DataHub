import type { Metadata } from "next";
import { Suspense } from "react";
import { DatasetReviews } from "@/features/annotation/review-pages";

export const metadata: Metadata = { title: "Dataset reviews" };
export default function Page() { return <Suspense><DatasetReviews /></Suspense>; }
