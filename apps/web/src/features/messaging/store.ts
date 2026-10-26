"use client";
import { useCallback } from "react";
import { useDemoState } from "@/lib/demo";
import type { Conversation, Msg } from "./types";

/** Persisted (localStorage) conversation store. Pass a different key + seeds for another inbox (e.g. admin). */
export function useConversations(key: string, seeds: Conversation[]) {
  const [conversations, set] = useDemoState<Conversation[]>(key, seeds);
  const send = useCallback((id: string, m: Msg) => set((p) => p.map((c) => (c.id === id ? { ...c, messages: [...c.messages, m], updatedAt: m.at } : c))), [set]);
  const markRead = useCallback((id: string) => set((p) => (p.some((c) => c.id === id && c.unread > 0) ? p.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) : p)), [set]);
  const create = useCallback((c: Conversation) => set((p) => [c, ...p]), [set]);
  return { conversations, send, markRead, create };
}
