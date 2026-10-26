import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSettings } from "@/features/admin/settings";

export const metadata: Metadata = { title: "Settings · Admin · DataHub" };
export default function Page() {
  return <Suspense><AdminSettings /></Suspense>;
}
