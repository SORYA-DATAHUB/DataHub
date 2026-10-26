import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StateScreen } from "@/features/system/state-screen";

export default function NotFound() {
  return (
    <StateScreen code="404" icon={<Compass size={26} aria-hidden />} title="Page not found" description="The page may have moved, or you may not have access to it. Check the address or head back to a known place."
      actions={<><Button href="/" size="lg">Back to home</Button><Button href="/help" size="lg" variant="outline">Visit help center</Button></>} />
  );
}
