import { Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/app-shell";
import { StateScreen } from "@/features/system/state-screen";

export const metadata: Metadata = { title: "Maintenance" };

export default function MaintenancePage() {
  return (
    <div className="min-h-dvh">
      <header className="px-6 py-5"><Logo /></header>
      <StateScreen code="503" tone="warning" icon={<Wrench size={26} aria-hidden />} title="We'll be right back" description="DataHub is undergoing scheduled maintenance. Uploads in progress will resume automatically and no data is lost."
        actions={<Button href="/" size="lg" variant="outline">Check again</Button>}>
        <p className="text-xs text-muted">Expected completion: within 30 minutes. Need help? <Link href="/help#contact" className="text-brand hover:underline">Contact support</Link>.</p>
      </StateScreen>
    </div>
  );
}
