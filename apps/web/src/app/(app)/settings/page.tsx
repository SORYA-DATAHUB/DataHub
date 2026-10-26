import type { Metadata } from "next";
import { Suspense } from "react";
import { Settings } from "@/features/contributor/settings";

export const metadata: Metadata = { title: "Settings" };
export default function Page() { return <Suspense><Settings /></Suspense>; }
