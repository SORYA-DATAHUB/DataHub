import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminUserDetail } from "@/features/admin/user-detail";

export const metadata: Metadata = { title: "User · Admin · DataHub" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense><AdminUserDetail id={id} /></Suspense>;
}
