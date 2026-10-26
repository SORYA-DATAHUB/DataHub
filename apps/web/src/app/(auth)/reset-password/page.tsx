import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/account-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-96 w-full" aria-hidden />}><ResetPasswordForm /></Suspense>;
}
