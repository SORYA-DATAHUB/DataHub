import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/features/auth/account-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-96 w-full" aria-hidden />}><ForgotPasswordForm /></Suspense>;
}
