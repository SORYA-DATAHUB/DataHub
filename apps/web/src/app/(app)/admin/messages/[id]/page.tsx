import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminInbox } from "@/features/admin/inbox";

export const metadata: Metadata = { title: "Conversation · Admin · DataHub" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense><AdminInbox activeId={id} /></Suspense>;
}
