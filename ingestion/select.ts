import type { DataSourceState } from "@prisma/client";
import type { SourceDefinition } from "@/lib/source-catalog";

export type SelectOptions = { only: string[]; disabled: string[]; alertsOnly: boolean };

/**
 * Origens a recolher nesta execução. Uma origem desativada no catálogo, sem recolhedor ou desligada
 * por INGEST_DISABLED_SOURCES nunca corre, mesmo quando é pedida pelo nome.
 */
export function selectSources(catalog: SourceDefinition[], collectors: Record<string, unknown>, { only, disabled, alertsOnly }: SelectOptions): SourceDefinition[] {
  return catalog.filter(
    (source) =>
      source.enabled &&
      !source.manualOnly &&
      Boolean(collectors[source.id]) &&
      !disabled.includes(source.id) &&
      (only.length === 0 || only.includes(source.id)) &&
      (!alertsOnly || source.group === "alertas" || source.group === "ocorrencias"),
  );
}

/**
 * Uma origem corre quando passou a sua frequência, quando é forçada, ou quando o recolhedor mudou de
 * versão desde a última recolha com sucesso: uma atualização da aplicação tem efeito logo.
 */
export function isDue(source: Pick<SourceDefinition, "frequencyHours" | "version">, state: Pick<DataSourceState, "lastSuccessAt" | "configVersion"> | null, now: Date, force = false): boolean {
  if (force || !state?.lastSuccessAt) return true;
  if (source.version !== undefined && state.configVersion !== source.version) return true;
  return state.lastSuccessAt.getTime() + source.frequencyHours * 3_600_000 <= now.getTime();
}
