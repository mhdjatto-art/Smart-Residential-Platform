"use client";

import { useState } from "react";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { StatusBadge } from "@/components/shared/status-badge";

interface LiveTicketStatusProps {
  ticketId: string;
  initialStatus: string;
}

export function LiveTicketStatus({ ticketId, initialStatus }: LiveTicketStatusProps) {
  const [status, setStatus] = useState(initialStatus);

  useRealtimeChannel<{ id: string; status: string }>({
    table: "tickets",
    filter: `id=eq.${ticketId}`,
    onUpdate: (row) => setStatus(row.status),
  });

  return <StatusBadge status={status} />;
}
