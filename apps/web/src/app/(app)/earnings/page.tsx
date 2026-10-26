import type { Metadata } from "next";
import { Suspense } from "react";
import { Earnings } from "@/features/contributor/earnings";

export const metadata: Metadata = { title: "Earnings" };
export default function Page() { return <Suspense><Earnings /></Suspense>; }
