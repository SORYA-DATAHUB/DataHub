import type { Metadata } from "next";
import { Suspense } from "react";
import { DatasetsList } from "@/features/contributor/datasets-list";

export const metadata: Metadata = { title: "My datasets" };
export default function Page() { return <Suspense><DatasetsList /></Suspense>; }
