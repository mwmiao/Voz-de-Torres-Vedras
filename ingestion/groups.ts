import type { PrismaClient } from "@prisma/client";
import type { SourceGroup } from "@/lib/source-catalog";
import { reconcileIncidents } from "./updaters/incidents";

/**
 * Trabalho comum a um grupo de origens, depois de todas as suas origens correrem. Devolve uma linha
 * para o resumo da execução.
 */
export const AFTER_GROUP: Partial<Record<SourceGroup, (db: PrismaClient, run: { startedAt: Date }) => Promise<string>>> = {
  // Estado, revisão e arquivo das ocorrências, a partir de todas as fontes recolhidas.
  ocorrencias: async (db, run) => {
    const reconciled = await reconcileIncidents(db, { now: new Date(), runStartedAt: run.startedAt });
    return `Ocorrências: ${reconciled.updated} reavaliadas, ${reconciled.archived} arquivadas, ${reconciled.pending} por rever.`;
  },
};
