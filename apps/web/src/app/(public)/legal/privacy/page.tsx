import type { Metadata } from "next";
import { LegalDoc } from "@/features/marketing/legal-doc";
import { privacy, UPDATED } from "@/features/marketing/legal-content";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return <LegalDoc title="Privacy Policy" updated={UPDATED} intro="What data we collect, why we collect it and the choices you have." sections={privacy} current="/legal/privacy" />;
}
