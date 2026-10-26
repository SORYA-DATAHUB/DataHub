"use client";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { StateScreen } from "@/features/system/state-screen";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <StateScreen code="Error" tone="danger" icon={<AlertTriangle size={26} aria-hidden />} title="Something went wrong" description="An unexpected error occurred. Your uploaded data and balance are safe. Try again, or contact support if it keeps happening."
      actions={<><Button size="lg" onClick={reset}>Try again</Button><Button href="/help#contact" size="lg" variant="outline">Contact support</Button></>}>
      {error.digest && <p className="text-xs text-muted">Reference: <span className="font-mono">{error.digest}</span></p>}
    </StateScreen>
  );
}
