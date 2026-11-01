import { buildAggregate, DEFAULT_MIN_PUBLIC_COUNT, type Aggregate } from "./aggregate";
import { db } from "./db";

export async function getSetting(key: string, fallback: number): Promise<number> {
  const row = await db.appSetting.findUnique({ where: { key } });
  const value = Number(row?.value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const getMinPublicCount = () => getSetting("min_public_count", DEFAULT_MIN_PUBLIC_COUNT);
export const getProposalThreshold = () => getSetting("proposal_threshold", 25);

/** Agrega por opção. Nenhuma consulta pública lê a tabela de posições de outra forma. */
export async function getAggregates(issueIds: string[]): Promise<Map<string, Aggregate>> {
  const [options, groups, minimum] = await Promise.all([
    db.issueOption.findMany({ where: { issueId: { in: issueIds } }, orderBy: { order: "asc" } }),
    db.position.groupBy({ by: ["optionId"], where: { issueId: { in: issueIds } }, _count: { _all: true } }),
    getMinPublicCount(),
  ]);
  const counts = new Map(groups.map((group) => [group.optionId, group._count._all]));
  const result = new Map<string, Aggregate>();
  for (const issueId of issueIds) {
    const rows = options
      .filter((option) => option.issueId === issueId)
      .map((option) => ({ id: option.id, label: option.label, count: (counts.get(option.id) ?? 0) + option.exampleCount }));
    result.set(issueId, buildAggregate(rows, minimum));
  }
  return result;
}

/** Só decisões com, pelo menos, uma fonte oficial chegam às páginas públicas. */
export const SOURCED_DECISION = { sources: { some: { official: true } } } as const;
