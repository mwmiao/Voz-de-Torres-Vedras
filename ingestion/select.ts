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
