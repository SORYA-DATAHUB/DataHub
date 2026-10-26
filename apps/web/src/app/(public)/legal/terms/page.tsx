import type { Metadata } from "next";
import { LegalDoc } from "@/features/marketing/legal-doc";
import { terms, UPDATED } from "@/features/marketing/legal-content";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Page() {
  return <LegalDoc title="Terms of Service" updated={UPDATED} intro="The rules for using DataHub as a contributor, annotator or reviewer." sections={terms} current="/legal/terms" />;
}
