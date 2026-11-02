import type { Agreement, GeoPrecision, IncidentCategory, IncidentPhase, SourceTier, VerificationStatus } from "@prisma/client";
import { REVIEW_DEFAULTS } from "./incidents";

const HOUR_MS = 3_600_000;

export type Thresholds = typeof REVIEW_DEFAULTS;

/** Limites a partir das variáveis de ambiente, com os valores por omissão. */
export function thresholdsFromEnv(env: Record<string, string | undefined> = process.env): Thresholds {
  const read = (name: string, fallback: number) => {
    const value = Number(env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    developingHours: read("INCIDENT_DEVELOPING_HOURS", REVIEW_DEFAULTS.developingHours),
    unconfirmedReviewHours: read("INCIDENT_REVIEW_HOURS", REVIEW_DEFAULTS.unconfirmedReviewHours),
    unconfirmedArchiveDays: read("INCIDENT_ARCHIVE_DAYS", REVIEW_DEFAULTS.unconfirmedArchiveDays),
    repetitionThreshold: read("INCIDENT_REPETITION_THRESHOLD", REVIEW_DEFAULTS.repetitionThreshold),
    engagementThreshold: read("INCIDENT_ENGAGEMENT_THRESHOLD", REVIEW_DEFAULTS.engagementThreshold),
  };
}

// ---------- Correspondência entre fontes ----------

/** Categorias que descrevem muitas vezes a mesma ocorrência com palavras diferentes. */
const RELATED: IncidentCategory[][] = [
  ["ROUBO", "FURTO"],
  ["ACIDENTE", "TRANSITO"],
  ["INCENDIO", "PROTECAO_CIVIL"],
  ["AGRESSAO", "VIOLENCIA_DOMESTICA"],
];
export const sameKind = (a: IncidentCategory, b: IncidentCategory) => a === b || RELATED.some((group) => group.includes(a) && group.includes(b));

export function fingerprintSimilarity(a: string, b: string): number {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  const shared = [...left].filter((item) => right.has(item)).length;
  return shared / (left.size + right.size - shared);
}

export type Claim = {
  category: IncidentCategory;
  freguesiaSlug: string;
  placeName: string;
  precision: GeoPrecision;
  incidentStart: Date;
  hasTime: boolean;
  titleFingerprint: string;
  /** A fonte desmente a ocorrência. */
  denies?: boolean;
};

export type Candidate = Claim & { id: string };

const PRECISION_RANK: Record<GeoPrecision, number> = { CONCELHO: -1, FREGUESIA: 0, ZONA_APROXIMADA: 1, LOCALIDADE: 2, AREA_PUBLICA: 3 };

/**
 * Procura a ocorrência a que um relato se refere, sem depender do texto exato do título: compara
 * categoria, freguesia, data e as impressões das palavras. Devolve também a concordância.
 */
export function matchClaim(claim: Claim, candidates: Candidate[]): { candidate: Candidate; agreement: Agreement; reason: string } | null {
  let best: { candidate: Candidate; agreement: Agreement; reason: string; score: number } | null = null;
  for (const candidate of candidates) {
    const hours = Math.abs(claim.incidentStart.getTime() - candidate.incidentStart.getTime()) / HOUR_MS;
    if (hours > 48) continue;
    const similarity = fingerprintSimilarity(claim.titleFingerprint, candidate.titleFingerprint);
    // Uma fonte que só indica o concelho não contradiz outra que indica a freguesia.
    const sameArea = claim.freguesiaSlug === candidate.freguesiaSlug || claim.precision === "CONCELHO" || candidate.precision === "CONCELHO";
    // «Segurança pública» é a categoria larga das detenções e apreensões: com títulos parecidos,
    // é a mesma ocorrência que uma fonte classificou como furto ou violência doméstica.
    const broad = (claim.category === "SEGURANCA_PUBLICA" || candidate.category === "SEGURANCA_PUBLICA") && similarity >= 0.2;
    const kind = sameKind(claim.category, candidate.category) || broad;
    // Duas localidades diferentes na mesma freguesia são, em regra, duas ocorrências.
    const otherPlace = sameArea && claim.precision === "LOCALIDADE" && candidate.precision === "LOCALIDADE" && claim.placeName !== candidate.placeName;
    let result: { agreement: Agreement; reason: string } | null = null;
    if (sameArea && kind && hours <= 36 && (!otherPlace || similarity >= 0.5)) {
      if (claim.denies) result = { agreement: "CONTRADIZ", reason: "a fonte desmente a ocorrência" };
      else if (otherPlace) result = { agreement: "CONTRADIZ", reason: "as fontes indicam localidades diferentes" };
      else {
        const detail = PRECISION_RANK[claim.precision] > PRECISION_RANK[candidate.precision] || (claim.hasTime && !candidate.hasTime);
        result = { agreement: detail ? "ACRESCENTA" : "CORROBORA", reason: detail ? "acrescenta local ou hora" : "mesma ocorrência" };
      }
    } else if (sameArea && !kind && similarity >= 0.4 && hours <= 36) {
      result = { agreement: "CONTRADIZ", reason: "as fontes descrevem tipos de ocorrência diferentes" };
    } else if (!sameArea && kind && similarity >= 0.5 && hours <= 36) {
      result = { agreement: "CONTRADIZ", reason: "as fontes indicam freguesias diferentes" };
    } else if (sameArea && kind && hours > 36 && similarity >= 0.5) {
      result = { agreement: "CONTRADIZ", reason: "as fontes indicam datas diferentes" };
    }
    if (!result) continue;
    const score = (sameArea ? 4 : 0) + (kind ? 2 : 0) + similarity - hours / 100;
    if (!best || score > best.score) best = { candidate, ...result, score };
  }
  return best ? { candidate: best.candidate, agreement: best.agreement, reason: best.reason } : null;
}

/** Cópias e partilhas: publicações não oficiais quase iguais, em poucas horas, contam como uma só afirmação. */
export function isNearDuplicate(a: { titleFingerprint: string; publicationDate: Date; sourceTier: SourceTier }, b: { titleFingerprint: string; publicationDate: Date; sourceTier: SourceTier }): boolean {
  const unofficial = (tier: SourceTier) => tier === "CONTA_OFICIAL" || tier === "COMUNITARIA";
  if (!unofficial(a.sourceTier) || !unofficial(b.sourceTier)) return false;
  const hours = Math.abs(a.publicationDate.getTime() - b.publicationDate.getTime()) / HOUR_MS;
  return hours <= 12 && fingerprintSimilarity(a.titleFingerprint, b.titleFingerprint) >= 0.8;
}

// ---------- Estado de verificação ----------

export type SourceLink = {
  sourceTier: SourceTier;
  agreement: Agreement | "PRINCIPAL";
  independenceKey: string;
  /** Repetição de outra publicação: guardada, mas não conta. */
  duplicate?: boolean;
  removed?: boolean;
};

export type VerificationInput = {
  primaryTier: SourceTier;
  phase: IncidentPhase | null;
  firstReportedAt: Date;
  now: Date;
  sources: SourceLink[];
  /** A publicação original mudou de forma substancial. */
  sourceChanged?: boolean;
  /** A fonte diz que os dados ainda estão incompletos ou por confirmar. */
  developing?: boolean;
  thresholds?: Thresholds;
};

export type VerificationResult = {
  status: VerificationStatus;
  hasConflict: boolean;
  /** Uma fonte oficial contradiz a ocorrência: deve ser arquivada. */
  officialContradiction: boolean;
};

const SUPPORT: (Agreement | "PRINCIPAL")[] = ["PRINCIPAL", "CORROBORA", "ACRESCENTA"];

/**
 * Regras:
 * - Uma fonte oficial que corrobora: «Confirmado».
 * - Factos essenciais em conflito, sem confirmação oficial: «Não confirmado».
 * - Primeira fonte da imprensa: «Reportado» (ou «Em apuramento», se estiver em curso).
 * - Primeira fonte em rede social ou comunitária: só passa a «Reportado» com duas redações independentes.
 *   Uma redação que repete uma publicação pode estar só a citá-la.
 * - Só redes sociais e fontes comunitárias: «Em apuramento» se for recente ou em curso, senão «Não confirmado».
 *   Repetição não é confirmação: várias contas com a mesma afirmação não mudam o estado.
 */
export function computeVerification(input: VerificationInput): VerificationResult {
  const thresholds = input.thresholds ?? REVIEW_DEFAULTS;
  const active = input.sources.filter((source) => !source.removed);
  const support = active.filter((source) => SUPPORT.includes(source.agreement) && !source.duplicate);
  const conflicts = active.filter((source) => source.agreement === "CONTRADIZ");
  const officialContradiction = conflicts.some((source) => source.sourceTier === "OFICIAL");
  const hasConflict = conflicts.length > 0;

  if (support.some((source) => source.sourceTier === "OFICIAL") && !officialContradiction) return { status: "CONFIRMADO", hasConflict, officialContradiction };
  if (hasConflict) return { status: "NAO_CONFIRMADO", hasConflict, officialContradiction };

  const ageHours = (input.now.getTime() - input.firstReportedAt.getTime()) / HOUR_MS;
  const developing = ageHours < thresholds.developingHours || ((input.phase === "EM_CURSO" || input.developing) && ageHours < thresholds.unconfirmedReviewHours);
  const press = new Set(support.filter((source) => source.sourceTier === "IMPRENSA").map((source) => source.independenceKey)).size;

  if (input.primaryTier === "IMPRENSA" || input.primaryTier === "OFICIAL") {
    // Uma fonte oficial principal que foi removida deixa de confirmar; a imprensa mantém «Reportado».
    if (press >= 1) return { status: (input.phase === "EM_CURSO" || input.developing) && developing ? "EM_APURAMENTO" : "REPORTADO", hasConflict, officialContradiction };
    return { status: developing ? "EM_APURAMENTO" : "NAO_CONFIRMADO", hasConflict, officialContradiction };
  }
  if (press >= 2) return { status: "REPORTADO", hasConflict, officialContradiction };
  if (input.sourceChanged) return { status: "NAO_CONFIRMADO", hasConflict, officialContradiction };
  return { status: developing ? "EM_APURAMENTO" : "NAO_CONFIRMADO", hasConflict, officialContradiction };
}

// ---------- Revisão e arquivo ----------

export type ReviewInput = {
  primaryTier: SourceTier;
  category: IncidentCategory;
  flags: string[];
  status: VerificationStatus;
  hasConflict: boolean;
  firstReportedAt: Date;
  now: Date;
  /** Publicações não oficiais sobre a ocorrência, incluindo repetições. */
  unofficialCount: number;
  engagement: number;
  /** Chegou informação nova a uma ocorrência «Em apuramento». */
  newInformation?: boolean;
  thresholds?: Thresholds;
};

const SERIOUS: IncidentCategory[] = ["VIOLENCIA_DOMESTICA", "AGRESSAO", "ROUBO"];

/** Motivos para pôr uma ocorrência na fila de revisão. Só se aplica a fontes não oficiais e a conflitos. */
export function reviewReasons(input: ReviewInput): string[] {
  const thresholds = input.thresholds ?? REVIEW_DEFAULTS;
  const unofficial = input.primaryTier === "CONTA_OFICIAL" || input.primaryTier === "COMUNITARIA";
  const reasons: string[] = [];
  if (input.hasConflict) reasons.push("fontes em conflito");
  if (!unofficial) return reasons;
  if (SERIOUS.includes(input.category) || input.flags.includes("grave")) reasons.push("alegação grave");
  if (input.category === "VIOLENCIA_DOMESTICA") reasons.push("violência doméstica");
  else if (input.category === "AGRESSAO" || input.flags.includes("violencia")) reasons.push("violência");
  if (input.flags.includes("menores")) reasons.push("envolve menores");
  if (input.unofficialCount >= thresholds.repetitionThreshold) reasons.push("muitas publicações repetidas");
  if (input.engagement >= thresholds.engagementThreshold) reasons.push("grande difusão");
  const unconfirmed = input.status === "NAO_CONFIRMADO" || input.status === "EM_APURAMENTO";
  if (unconfirmed && input.now.getTime() - input.firstReportedAt.getTime() > thresholds.unconfirmedReviewHours * HOUR_MS) reasons.push("sem confirmação há mais de 48 horas");
  if (input.newInformation && input.status === "EM_APURAMENTO") reasons.push("informação nova");
  return reasons;
}

/**
 * Fica retida até revisão, fora do mapa: uma acusação anónima sobre menores ou violência doméstica
 * pode causar dano mesmo marcada como «Não confirmado».
 */
export function mustHold(input: Pick<ReviewInput, "primaryTier" | "category" | "flags">, ambiguous: boolean): boolean {
  const unofficial = input.primaryTier === "CONTA_OFICIAL" || input.primaryTier === "COMUNITARIA";
  return ambiguous || (unofficial && (input.category === "VIOLENCIA_DOMESTICA" || input.flags.includes("menores")));
}

export function archiveReason(input: {
  status: VerificationStatus;
  officialContradiction: boolean;
  primaryRemoved: boolean;
  primaryTier: SourceTier;
  firstReportedAt: Date;
  now: Date;
  thresholds?: Thresholds;
}): string | null {
  const thresholds = input.thresholds ?? REVIEW_DEFAULTS;
  if (input.officialContradiction) return "contrariada por uma fonte oficial";
  if (input.primaryRemoved && (input.status === "NAO_CONFIRMADO" || input.status === "EM_APURAMENTO")) return "a publicação original foi removida";
  const unconfirmed = input.status === "NAO_CONFIRMADO" || input.status === "EM_APURAMENTO";
  if (unconfirmed && input.now.getTime() - input.firstReportedAt.getTime() > thresholds.unconfirmedArchiveDays * 24 * HOUR_MS) {
    return `sem confirmação ao fim de ${thresholds.unconfirmedArchiveDays} dias`;
  }
  return null;
}
