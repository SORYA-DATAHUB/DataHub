import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { StateScreen } from "@/features/system/state-screen";

export const metadata: Metadata = { title: "Access denied" };

export default function AccessDeniedPage() {
  return (
    <StateScreen code="403" tone="warning" icon={<ShieldAlert size={26} aria-hidden />} title="You don't have access to this page" description="Your account does not have the role this area requires. If you think this is a mistake, ask a Super Administrator to grant access."
      actions={<><Button href="/dashboard" size="lg">Back to dashboard</Button><Button href="/help#contact" size="lg" variant="outline">Request access</Button></>} />
  );
}
