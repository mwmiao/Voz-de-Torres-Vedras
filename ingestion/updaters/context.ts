import type { PrismaClient, UpdateCategory, UpdateStatus } from "@prisma/client";
import type { Change } from "./diff";

/** Na primeira execução, só o que é recente aparece como novidade: o resto é o arquivo existente. */
const BASELINE_WINDOW_DAYS = 45;

export type ApplyContext = {
  db: PrismaClient;
  sourceId: string;
  runId: string;
  now: Date;
  baseline: boolean;
};

type EventInput = {
  entityType: string;
  entityKey: string;
  status: UpdateStatus;
  category: UpdateCategory;
  title: string;
  sourceUrl: string;
  date?: Date | null;
  changes?: Change[];
};

export async function emit(context: ApplyContext, event: EventInput) {
  if (context.baseline) {
    const limit = context.now.getTime() - BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (event.status !== "NEW" || !event.date || event.date.getTime() < limit) return;
  }
  const { date, changes = [], ...fields } = event;
  await context.db.updateEvent.create({
    data: {
      ...fields,
      dataSourceId: context.sourceId,
      runId: context.runId,
      occurredAt: context.baseline && date ? date : context.now,
      changes: { create: changes },
    },
  });
}
