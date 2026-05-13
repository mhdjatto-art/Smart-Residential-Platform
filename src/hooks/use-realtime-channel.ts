"use client";

/**
 * useRealtimeChannel — subscribes to Postgres-changes events on a single table
 * via Supabase realtime. RLS is enforced server-side, so the channel only
 * receives rows the current user is allowed to see.
 *
 * Usage:
 *   useRealtimeChannel({
 *     table: "notifications",
 *     filter: `recipient_user_id=eq.${userId}`,
 *     onInsert: (row) => …,
 *     onUpdate: (row) => …,
 *     onDelete: (row) => …,
 *   });
 */

import { useEffect, useId, useRef } from "react";
import type { RealtimePostgresChangesPayload, RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

export interface UseRealtimeChannelOpts<T extends Row = Row> {
  /** Postgres table to watch (public schema assumed). */
  table: string;
  /** Optional row-level filter, e.g. `recipient_user_id=eq.${userId}`. */
  filter?: string;
  /** Optional stable channel name (auto-generated otherwise). */
  channelName?: string;
  onInsert?: (row: T) => void;
  onUpdate?: (row: T, old: T) => void;
  onDelete?: (row: T) => void;
  /** Suspend the subscription without unmounting. */
  enabled?: boolean;
}

export function useRealtimeChannel<T extends Row = Row>(opts: UseRealtimeChannelOpts<T>) {
  const { table, filter, channelName, onInsert, onUpdate, onDelete, enabled = true } = opts;
  const handlersRef = useRef({ onInsert, onUpdate, onDelete });
  handlersRef.current = { onInsert, onUpdate, onDelete };

  // Unique per React-tree instance — avoids "cannot add callbacks after subscribe()"
  // when the same component is mounted in two places (e.g. responsive duplicates).
  const instanceId = useId();

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const name = channelName ?? `rt-${table}-${filter ?? "all"}-${instanceId}`;

    const channel: RealtimeChannel = supabase.channel(name).on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
      (payload: RealtimePostgresChangesPayload<T>) => {
        if (payload.eventType === "INSERT") handlersRef.current.onInsert?.(payload.new as T);
        if (payload.eventType === "UPDATE") handlersRef.current.onUpdate?.(payload.new as T, payload.old as T);
        if (payload.eventType === "DELETE") handlersRef.current.onDelete?.(payload.old as T);
      },
    );
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, channelName, enabled, instanceId]);
}
