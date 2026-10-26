import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmail } from "@/features/auth/account-forms";

export const metadata: Metadata = { title: "Verify email" };

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-96 w-full" aria-hidden />}><VerifyEmail /></Suspense>;
}
