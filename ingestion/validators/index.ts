import { StructureError, type IngestRecord } from "../types";

const isHttp = (url: string) => /^https?:\/\//.test(url);

/** Devolve os problemas de um registo. Com algum problema, o registo não é gravado. */
export function validateRecord(record: IngestRecord): string[] {
  const problems: string[] = [];
  const need = (condition: unknown, field: string) => {
    if (!condition) problems.push(`campo em falta ou inválido: ${field}`);
  };
  switch (record.kind) {
    case "document":
      need(isHttp(record.url), "url");
      need(record.title.trim().length >= 3, "title");
      need(record.publisher, "publisher");
      break;
    case "contract":
      need(record.baseId, "baseId");
      need(record.title, "title");
      need(record.awardingNif, "awardingNif");
      need(Number.isFinite(record.priceEur), "priceEur");
      need(isHttp(record.sourceUrl), "sourceUrl");
      break;
    case "modification":
      need(record.baseId, "baseId");
      need(record.date, "date");
      need(isHttp(record.sourceUrl), "sourceUrl");
      break;
    case "meeting":
      need(!Number.isNaN(record.date.getTime()), "date");
      need(record.title, "title");
      need(isHttp(record.sourceUrl), "sourceUrl");
      break;
    case "official":
      need(record.name.length >= 5, "name");
      need(record.role, "role");
      need(isHttp(record.sourceUrl), "sourceUrl");
      break;
    case "finance":
      need(record.label, "label");
      need(Number.isFinite(record.amountEur) && record.amountEur >= 0, "amountEur");
      need(isHttp(record.sourceUrl), "sourceUrl");
      break;
  }
  return problems;
}

/** Para a recolha quando há demasiado poucos itens: quase sempre, a página mudou de estrutura. */
export function assertMinimum<T>(items: T[], minimum: number, what: string): T[] {
  if (items.length < minimum) {
    throw new StructureError(`${what}: encontrados ${items.length}, esperados pelo menos ${minimum}.`);
  }
  return items;
}

export function assertContains(text: string, marker: RegExp, what: string) {
  if (!marker.test(text)) throw new StructureError(`${what}: marcador esperado não encontrado.`);
}
