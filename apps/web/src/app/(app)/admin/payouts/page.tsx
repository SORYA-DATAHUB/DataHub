import { Suspense } from "react";
import { PayoutsPage } from "@/features/finance/payouts-page";

export const metadata = { title: "Payout requests · DataHub Admin" };
export default function Page() { return <Suspense><PayoutsPage /></Suspense>; }
