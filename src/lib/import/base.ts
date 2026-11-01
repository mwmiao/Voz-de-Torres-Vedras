/** Normalização do conjunto de dados do Portal BASE publicado pelo IMPIC em dados.gov.pt. */

export const BASE_DATASET_URL =
  "https://dados.gov.pt/pt/datasets/contratos-publicos-portal-base-impic-contratos-de-2012-a-2026/";

export const MUNICIPAL_NIFS = ["502173653", "680015973"];

export type BaseRecord = {
  idcontrato: string | number;
  tipoContrato?: string[] | null;
  tipoprocedimento?: string | null;
  objectoContrato?: string | null;
  adjudicante?: string[] | null;
  adjudicatarios?: string[] | null;
  dataPublicacao?: string | null;
  dataCelebracaoContrato?: string | null;
  precoContratual?: number | string | null;
  cpv?: string[] | null;
  prazoExecucao?: number | string | null;
};

export type NormalizedContract = {
  baseId: string;
  title: string;
  awardingBody: string;
  awardingNif: string;
  supplierName: string;
  supplierNif: string | null;
  supplierIsPerson: boolean;
  procedureType: string;
  contractType: string | null;
  cpvCode: string | null;
  cpvLabel: string | null;
  priceEur: number;
  signedAt: Date | null;
  publishedAt: Date | null;
  durationDays: number | null;
  sourceUrl: string;
};

/** O conjunto de dados traz entidades HTML e aspas e travessões Windows-1252 como caracteres de controlo. */
function decodeEntities(text: string): string {
  return text
    .replaceAll("&amp;amp;", "&")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/[\u0091\u0092]/g, "'")
    .replace(/[\u0093\u0094]/g, '"')
    .replace(/[\u0096\u0097]/g, "–")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, " ");
}

/** Entradas no formato "NIF - Nome". */
function splitEntity(entry: string): { nif: string; name: string } {
  const index = entry.indexOf(" - ");
  if (index < 0) return { nif: "", name: decodeEntities(entry.trim()) };
  return { nif: entry.slice(0, index).trim(), name: decodeEntities(entry.slice(index + 3).trim().replace(/\s+/g, " ")) };
}

/** Datas em dd/mm/aaaa. */
export function parseDate(value: string | null | undefined): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value?.trim() ?? "");
  if (!match) return null;
  return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12));
}

/** NIF iniciado por 1, 2 ou 3 identifica uma pessoa singular. */
export function isPersonNif(nif: string): boolean {
  return /^[123]\d{8}$/.test(nif);
}

export const PERSON_SUPPLIER_LABEL = "Pessoa singular (consultar no Portal BASE)";

const LEGAL_ENTITY = /\b(lda|l\.da|ld\.ª|limitada|s\.?a\.?|unipessoal|sociedade|associa[çc][ãa]o|gmbh|ltd|inc|s\.?l\.?|crl|cooperativa|funda[çc][ãa]o|instituto|universidade|companhia|empresa|grupo|centro|clube|uni[ãa]o|junta|comunidade|munic[íi]pio|c[âa]mara|freguesia|f[áa]brica|igreja|servi[çc]os|ag[êe]ncia|portugal|ipss)\b/i;

/** O IMPIC mascara o NIF das pessoas singulares com «-». Sem NIF, só um nome de empresa fica publicado. */
export function isPersonSupplier(nif: string | null, name: string): boolean {
  if (nif && isPersonNif(nif)) return true;
  return !/^\d/.test(nif ?? "") && !LEGAL_ENTITY.test(name);
}

export function baseContractUrl(id: string): string {
  return `https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=${id}`;
}

export function normalizeBaseRecord(record: BaseRecord): NormalizedContract | null {
  const awarding = splitEntity(record.adjudicante?.[0] ?? "");
  if (!MUNICIPAL_NIFS.includes(awarding.nif)) return null;

  const suppliers = (record.adjudicatarios ?? []).map(splitEntity);
  const hasPerson = suppliers.some((supplier) => isPersonSupplier(supplier.nif, supplier.name));
  const price = Number(record.precoContratual);
  const baseId = String(record.idcontrato);
  if (!baseId || !Number.isFinite(price)) return null;

  const cpv = record.cpv?.[0] ? splitEntity(record.cpv[0]) : null;
  const duration = Number(record.prazoExecucao);

  return {
    baseId,
    title: decodeEntities(record.objectoContrato ?? "Sem designação").trim(),
    awardingBody: awarding.nif === "680015973" ? "SMAS de Torres Vedras" : "Município de Torres Vedras",
    awardingNif: awarding.nif,
    supplierName: hasPerson
      ? PERSON_SUPPLIER_LABEL
      : suppliers.map((supplier) => supplier.name).join("; ") || "Não indicado",
    supplierNif: hasPerson ? null : (suppliers[0]?.nif ?? null),
    supplierIsPerson: hasPerson,
    procedureType: decodeEntities(record.tipoprocedimento ?? "Não indicado"),
    contractType: record.tipoContrato?.[0] ?? null,
    cpvCode: cpv?.nif ?? null,
    cpvLabel: cpv?.name ?? null,
    priceEur: price,
    signedAt: parseDate(record.dataCelebracaoContrato),
    publishedAt: parseDate(record.dataPublicacao),
    durationDays: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    sourceUrl: baseContractUrl(baseId),
  };
}
