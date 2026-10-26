import type { Metadata } from "next";
import { Suspense } from "react";
import { Onboarding } from "@/features/auth/onboarding";

export const metadata: Metadata = { title: "Onboarding" };

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-96 w-full" aria-hidden />}><Onboarding /></Suspense>;
}
