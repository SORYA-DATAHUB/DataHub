import type { Metadata } from "next";
import { LegalDoc } from "@/features/marketing/legal-doc";
import { agreement, UPDATED } from "@/features/marketing/legal-content";

export const metadata: Metadata = { title: "Contributor Agreement" };

export default function Page() {
  return <LegalDoc title="Contributor Agreement" updated={UPDATED} intro="The commitments you make when you upload content or complete annotation work." sections={agreement} current="/legal/contributor-agreement" />;
}
