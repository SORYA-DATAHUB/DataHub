import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminInbox } from "@/features/admin/inbox";

export const metadata: Metadata = { title: "Messages · Admin · DataHub" };
export default function Page() {
  return <Suspense><AdminInbox /></Suspense>;
}
