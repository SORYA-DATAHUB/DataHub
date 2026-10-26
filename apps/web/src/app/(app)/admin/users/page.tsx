import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminUsers } from "@/features/admin/users-table";

export const metadata: Metadata = { title: "Users · Admin · DataHub" };
export default function Page() {
  return <Suspense><AdminUsers /></Suspense>;
}
