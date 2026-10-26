import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WithdrawalDetail } from "@/features/contributor/withdrawal-detail";

export const metadata: Metadata = { title: "Withdrawal details" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^PO-\d{4,}$/.test(id)) notFound();
  return <Suspense><WithdrawalDetail id={id} /></Suspense>;
}
