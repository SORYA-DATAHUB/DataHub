import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/features/auth/account-forms";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  return <Suspense fallback={<div className="skeleton h-96 w-full" aria-hidden />}><RegisterForm /></Suspense>;
}
