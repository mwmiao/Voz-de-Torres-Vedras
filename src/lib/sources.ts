import type { SourceType } from "@prisma/client";

/** Domínios de entidades públicas aceites como fonte primária. */
const OFFICIAL_HOSTS = [
  "cm-tvedras.pt",
  "am-tvedras.pt",
  "base.gov.pt",
  "dre.pt",
  "diariodarepublica.pt",
  "dados.gov.pt",
  "acingov.pt",
  "portaldatransparencia.gov.pt",
  "transparencia.gov.pt",
  "portalautarquico.dgal.gov.pt",
  "tribunalconstitucional.pt",
  "ine.pt",
  "ipma.pt",
  "smastv.pt",
];

/** Vídeo em plataforma externa só conta quando é a transmissão publicada pelo próprio órgão. */
const OFFICIAL_VIDEO_HOSTS = ["youtube.com", "youtu.be"];

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isOfficialUrl(url: string, type?: SourceType): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  const host = parsed.hostname.toLowerCase();
  if (OFFICIAL_HOSTS.some((domain) => hostMatches(host, domain))) return true;
  return type === "VIDEO" && OFFICIAL_VIDEO_HOSTS.some((domain) => hostMatches(host, domain));
}

type SourceLike = { official: boolean };

/** Uma afirmação só é apresentada como facto com, pelo menos, uma fonte oficial. */
export function isVerified(sources: SourceLike[]): boolean {
  return sources.some((source) => source.official);
}

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  ATA: "Ata",
  MINUTA: "Ata em minuta",
  VIDEO: "Vídeo",
  AGENDA: "Ponto de agenda",
  EDITAL: "Edital",
  DOCUMENTO_PDF: "Documento PDF",
  ORCAMENTO: "Orçamento",
  CONTRATO: "Contrato",
  DIARIO_REPUBLICA: "Diário da República",
  PAGINA_OFICIAL: "Página oficial",
  DATASET: "Dados abertos",
  REGULAMENTO: "Regulamento",
  CONCURSO: "Procedimento",
};
