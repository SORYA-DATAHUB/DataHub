import { Suspense } from "react";
import { FinancePage } from "@/features/finance/finance-page";

export const metadata = { title: "Finance · DataHub Admin" };
export default function Page() { return <Suspense><FinancePage /></Suspense>; }
