import type { Metadata } from "next";
import { LegalDoc } from "@/features/marketing/legal-doc";
import { ownership, UPDATED } from "@/features/marketing/legal-content";

export const metadata: Metadata = { title: "Data Ownership and Licensing Policy" };

export default function Page() {
  return <LegalDoc title="Data Ownership and Licensing Policy" updated={UPDATED} intro="Who owns contributed data, and what licence DataHub receives." sections={ownership} current="/legal/data-ownership" />;
}
