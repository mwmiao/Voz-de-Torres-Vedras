import type {
  Agreement,
  AlertSeverity,
  AlertType,
  Body,
  BudgetKind,
  GeographicAreaType,
  GeoPrecision,
  IncidentCategory,
  IncidentPhase,
  SourceTier,
  SourceType,
  UpdateCategory,
} from "@prisma/client";
import type { NormalizedContract } from "@/lib/import/base";

export type DocumentRecord = {
  kind: "document";
  url: string;
  title: string;
  publisher: string;
  docType: SourceType;
  category: UpdateCategory;
  publishedAt?: Date | null;
  data?: Record<string, unknown>;
};

export type ContractRecord = { kind: "contract" } & NormalizedContract;

export type ModificationRecord = {
  kind: "modification";
  baseId: string;
  date: Date | null;
  actType: string | null;
  grounds: string | null;
  newPriceEur: number | null;
  newDurationDays: number | null;
  publishedAt: Date | null;
  sourceUrl: string;
};

export type MeetingRecord = {
  kind: "meeting";
  body: Body;
  date: Date;
  hasTime: boolean;
  title: string;
  location: string | null;
  sourceUrl: string;
};

export type OfficialRecord = {
  kind: "official";
  name: string;
  role: string;
  party: string | null;
  portfolios: string[];
  sourceUrl: string;
};

export type FinanceRecord = {
  kind: "finance";
  year: number;
  budgetKind: BudgetKind;
  label: string;
  amountEur: number;
  asOf: Date;
  sourceUrl: string;
};

export type AlertRecord = {
  kind: "alert";
  key: string;
  title: string;
  type: AlertType;
  severity: AlertSeverity;
  description: string;
  startsAt: Date | null;
  endsAt: Date | null;
  hasOfficialEnd: boolean;
  hasTime: boolean;
  area: string;
  areaType: GeographicAreaType;
  publishedAt: Date | null;
  sourceUrl: string;
};

export type CrimeRecordInput = {
  kind: "crime";
  categoryCode: string;
  year: number;
  count: number | null;
  confidential: boolean;
  officialRate: number | null;
  sourceUrl: string;
  publishedAt: Date | null;
};

export type PopulationRecord = { kind: "population"; year: number; population: number; sourceUrl: string; publishedAt: Date | null };

export type IncidentRecord = {
  kind: "incident";
  /** URL canónico da notícia, comunicado ou publicação. */
  sourceUrl: string;
  sourceName: string;
  sourceTier: SourceTier;
  independenceKey: string;
  author: string | null;
  articleCategory?: string | null;
  publishedAt: Date | null;
  incidentStart: Date | null;
  incidentEnd: Date | null;
  hasTime: boolean;
  category: IncidentCategory;
  tags: string[];
  summary: string;
  /** Afirmação estruturada, sem texto original. */
  claim: string;
  titleFingerprint: string;
  textFingerprint: string;
  phase: IncidentPhase | null;
  denies: boolean;
  flags: string[];
  /** Dúvidas que impedem a publicação até revisão, como várias freguesias. */
  doubts: string[];
  linkPublic: boolean;
  linkNote: string | null;
  engagement: number;
  /** A publicação original foi apagada. */
  removed: boolean;
  /** Ligação explícita a uma ocorrência existente, nos registos à mão. */
  incidentKey?: string;
  agreement?: Agreement;
  freguesiaSlug: string | null;
  placeName: string | null;
  precision: GeoPrecision | null;
  latitude: number | null;
  longitude: number | null;
  radiusM: number | null;
};

/** Artigo lido e recusado: fica só no registo de auditoria. */
export type IncidentRejection = { kind: "incident-rejected"; sourceUrl: string; reason: string };

export type IngestRecord =
  | DocumentRecord
  | ContractRecord
  | ModificationRecord
  | MeetingRecord
  | OfficialRecord
  | FinanceRecord
  | AlertRecord
  | CrimeRecordInput
  | PopulationRecord
  | IncidentRecord
  | IncidentRejection;

export class StructureError extends Error {
  constructor(message: string) {
    super(`Estrutura da fonte alterada: ${message}`);
    this.name = "StructureError";
  }
}

/** Resultado de uma recolha. `unchanged` indica que a origem não publicou nada de novo. */
export type Collected = { unchanged: true } | { unchanged?: false; records: IngestRecord[]; revision?: string; complete?: boolean };
