import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesView } from "@/features/contributor/messages-view";

export const metadata: Metadata = { title: "Messages" };
/** The inbox lives in the layout so it stays mounted when switching conversations (keeps typing indicator and simulated replies alive). */
export default function MessagesLayout() { return <Suspense><MessagesView /></Suspense>; }
