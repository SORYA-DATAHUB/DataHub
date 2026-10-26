import { notFound } from "next/navigation";
import { PayoutDetail } from "@/features/finance/payout-detail";
import { payouts } from "@/mock/data";

export const metadata = { title: "Payout · DataHub Admin" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!payouts.some((p) => p.id === id)) notFound();
  return <PayoutDetail id={id} />;
}
