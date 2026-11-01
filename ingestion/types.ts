import type { AlertSeverity, AlertType, Body, BudgetKind, GeographicAreaType, SourceType, UpdateCategory } from "@prisma/client";
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

export type IngestRecord = DocumentRecord | ContractRecord | ModificationRecord | MeetingRecord | OfficialRecord | FinanceRecord | AlertRecord | CrimeRecordInput | PopulationRecord;

export class StructureError extends Error {
  constructor(message: string) {
    super(`Estrutura da fonte alterada: ${message}`);
    this.name = "StructureError";
  }
}

/** Resultado de uma recolha. `unchanged` indica que a origem não publicou nada de novo. */
export type Collected = { unchanged: true } | { unchanged?: false; records: IngestRecord[]; revision?: string; complete?: boolean };
