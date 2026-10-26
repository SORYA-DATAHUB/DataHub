import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "brand" | "warning" | "danger";
const tones: Record<Tone, string> = { brand: "bg-brand-soft text-brand", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger" };

/** Full-height centered message used by 404, error, access-denied and maintenance screens. Safe in server and client components. */
export function StateScreen({ code, icon, tone = "brand", title, description, actions, children }: { code?: string; icon: ReactNode; tone?: Tone; title: string; description: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <main id="main" className="flex min-h-[70dvh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <span className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-2xl", tones[tone])}>{icon}</span>
        {code && <p className="mt-6 font-mono text-sm font-medium text-muted">{code}</p>}
        <h1 className={cn("text-2xl font-semibold tracking-tight sm:text-3xl", code ? "mt-2" : "mt-6")}>{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        {actions && <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </main>
  );
}
