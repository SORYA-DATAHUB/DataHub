"use client";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { UIProvider } from "@/components/ui/overlays";

export function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange><UIProvider>{children}</UIProvider></ThemeProvider>;
}
