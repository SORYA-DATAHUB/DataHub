import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <Suspense fallback={<div className="skeleton h-96 w-full" aria-hidden />}><LoginForm /></Suspense>;
}
