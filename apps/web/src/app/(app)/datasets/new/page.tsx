import type { Metadata } from "next";
import { Suspense } from "react";
import { Uploader } from "@/features/contributor/uploader";

export const metadata: Metadata = { title: "Upload dataset" };
export default function Page() { return <Suspense><Uploader /></Suspense>; }
