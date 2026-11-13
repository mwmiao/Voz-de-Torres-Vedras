import type { SourceTier } from "@prisma/client";
import { isOfficialUrl, isSocialMediaUrl } from "./sources";

/** Autoridades e entidades públicas, além dos domínios oficiais já aceites noutras secções. */
const AUTHORITY_HOSTS = ["gnr.pt", "psp.pt", "prociv.gov.pt", "anepc.gov.pt", "ipma.pt", "cm-tvedras.pt", "smastv.pt", "tribunais.org.pt", "citius.mj.pt", "ministeriopublico.pt", "portugal.gov.pt", "sns.gov.pt"];

/** Redações com responsabilidade editorial, nacionais e regionais. */
const NEWS_HOSTS = [
  "noticiasaominuto.com",
  "lusa.pt",
  "rtp.pt",
  "sicnoticias.pt",
  "cnnportugal.iol.pt",
  "tvi.iol.pt",
  "publico.pt",
  "observador.pt",
  "expresso.pt",
  "jn.pt",
  "dn.pt",
  "cmjornal.pt",
  "sapo.pt",
  "tsf.pt",
  "rr.pt",
  "badaladas.pt",
  "rtvon.pt",
  "onfm.pt",
  "frenteoeste.pt",
  "oestediario.pt",
  "jornaldascaldas.com",
  "gazetadascaldas.pt",
  "regiaodeleiria.pt",
];

/** Contas em redes sociais e fontes comunitárias: níveis 3 e 4. */
export const isUnofficial = (tier: SourceTier) => tier === "CONTA_OFICIAL" || tier === "COMUNITARIA";

/** Conta numa rede social, identificada por plataforma e nome, por exemplo «telegram:gnrportugal». */
export type AccountEntry = { platform: string; handle: string; name: string; tier: "CONTA_OFICIAL" | "COMUNITARIA" };

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};
const matches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/**
 * Nível da fonte: 1 autoridade, 2 imprensa, 3 conta oficial em rede social, 4 fonte comunitária.
 * Uma conta só é nível 3 quando está registada como pertencendo a uma autoridade ou redação.
 */
export function classifySourceTier(url: string, account?: { platform: string; handle: string } | null, registry: AccountEntry[] = []): SourceTier {
  const host = hostOf(url);
  if (account || isSocialMediaUrl(url) || isFediverseOrMessaging(url)) {
    const known = account && registry.find((entry) => entry.platform === account.platform && entry.handle.toLowerCase() === account.handle.toLowerCase());
    return known?.tier === "CONTA_OFICIAL" ? "CONTA_OFICIAL" : "COMUNITARIA";
  }
  if (AUTHORITY_HOSTS.some((domain) => matches(host, domain)) || isOfficialUrl(url)) return "OFICIAL";
  if (NEWS_HOSTS.some((domain) => matches(host, domain))) return "IMPRENSA";
  return "COMUNITARIA";
}

function isFediverseOrMessaging(url: string): boolean {
  const host = hostOf(url);
  // Instâncias Mastodon e canais públicos de Telegram.
  return /\/@[^/]+\/\d+/.test(url) || ["masto.pt", "mastodon.social", "t.me", "bsky.app"].some((domain) => matches(host, domain));
}

/**
 * Fonte independente: duas publicações com a mesma chave contam como uma. As notícias da Lusa
 * republicadas por várias redações são a mesma fonte.
 */
export function independenceKey(url: string, author?: string | null, account?: { platform: string; handle: string } | null): string {
  if (account) return `${account.platform}:${account.handle.toLowerCase()}`;
  if (author && /\blusa\b/i.test(author)) return "lusa";
  // Comunicados da Câmara republicados por uma rádio ou jornal são da Câmara, não da redação.
  if (author && /\b(cm|c\.m\.|camara municipal|câmara municipal|município)\s+(de\s+)?torres vedras\b/i.test(author)) return "cm-tvedras.pt";
  return hostOf(url);
}

/** Plataformas cujas publicações não podem ser arquivadas publicamente: a ligação nunca é publicada. */
const UNARCHIVABLE = ["whatsapp.com", "wa.me", "instagram.com/stories", "facebook.com/groups", "fb.com/groups"];

export function isArchivable(url: string): boolean {
  const target = url.toLowerCase();
  return !UNARCHIVABLE.some((fragment) => target.includes(fragment));
}

/**
 * Indícios de dados pessoais num texto: idades, matrículas, moradas, telefones e nomes próprios.
 * Serve para não publicar a ligação; o texto em si nunca é guardado.
 */
export function detectPersonalData(text: string): string[] {
  const found: string[] = [];
  if (/\b\d{1,2}\s+anos\b/i.test(text)) found.push("idade");
  if (/\b([A-Z]{2}-\d{2}-[A-Z]{2}|\d{2}-[A-Z]{2}-\d{2}|\d{2}-\d{2}-[A-Z]{2}|[A-Z]{2}-\d{2}-\d{2})\b/.test(text)) found.push("matrícula");
  if (/\b(rua|avenida|av\.|travessa|largo|praceta|estrada)\s+[A-ZÀ-Ú][^,.;]{2,40}?,?\s*(n\.?º\s*)?\d+/i.test(text)) found.push("morada");
  if (/\b(?:\+351\s?)?9[1236]\d[\s.]?\d{3}[\s.]?\d{3}\b/.test(text)) found.push("telefone");
  if (/\b(?:sr\.?|sra\.?|senhor|senhora|chamad[oa]|de nome)\s+[A-ZÀ-Ú][a-zà-ú]+/.test(text)) found.push("nome");
  return found;
}
