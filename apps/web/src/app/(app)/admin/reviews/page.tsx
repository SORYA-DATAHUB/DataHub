import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminReviews } from "@/features/admin/reviews-queue";

export const metadata: Metadata = { title: "Review queue · Admin · DataHub" };
export default function Page() {
  return <Suspense><AdminReviews /></Suspense>;
}
