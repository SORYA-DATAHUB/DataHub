import type { Metadata } from "next";
import { Suspense } from "react";
import { Withdrawals } from "@/features/contributor/withdrawals";

export const metadata: Metadata = { title: "Withdrawals" };
export default function Page() { return <Suspense><Withdrawals /></Suspense>; }
