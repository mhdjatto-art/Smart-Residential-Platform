"use server";

import { requireRole } from "@/lib/auth/guards";
import { pushQueuedJournalEntries, type PushRunSummary } from "@/lib/erp/worker";
import { revalidatePath } from "next/cache";

export async function runErpPushWorker(): Promise<PushRunSummary> {
  await requireRole(["super_admin", "developer_admin", "finance_officer"]);
  const summary = await pushQueuedJournalEntries();
  revalidatePath("/erp");
  revalidatePath("/erp/entries");
  return summary;
}
