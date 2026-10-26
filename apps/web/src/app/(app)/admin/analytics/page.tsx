import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAnalytics } from "@/features/admin/analytics";

export const metadata: Metadata = { title: "Analytics · Admin · DataHub" };
export default function Page() {
  return <Suspense><AdminAnalytics /></Suspense>;
}
