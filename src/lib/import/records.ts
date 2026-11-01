import { parse } from "csv-parse/sync";
import { z } from "zod";
import { isOfficialUrl } from "@/lib/sources";

const BODIES = ["ASSEMBLEIA_MUNICIPAL", "EXECUTIVO_MUNICIPAL"] as const;
const OUTCOMES = ["APROVADO", "REPROVADO", "ADIADO", "RETIRADO", "TOMADA_CONHECIMENTO", "REMETIDO", "POR_PUBLICAR"] as const;
const VOTE_MODES = ["UNANIMIDADE", "MAIORIA", "NAO_APLICAVEL"] as const;
const SOURCE_TYPES = ["ATA", "MINUTA", "VIDEO", "AGENDA", "EDITAL", "DOCUMENTO_PDF", "ORCAMENTO"] as const;

const optionalInt = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : Number(value)),
  z.number().int().nonnegative().optional(),
);

/**
 * Formato genérico de decisões (CSV ou JSON). Uma linha sem documento oficial
 * é recusada: o Registo não admite decisões sem fonte primária.
 */
export const decisionRowSchema = z
  .object({
    body: z.enum(BODIES),
    meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato AAAA-MM-DD"),
    meetingTitle: z.string().min(3),
    itemNumber: z.string().optional(),
    proposalRef: z.string().optional(),
    title: z.string().min(3),
    outcome: z.enum(OUTCOMES),
    voteMode: z.enum(VOTE_MODES).default("NAO_APLICAVEL"),
    votesFor: optionalInt,
    votesAgainst: optionalInt,
    abstentions: optionalInt,
    sourceName: z.string().min(3),
    sourceTitle: z.string().min(3),
    sourceUrl: z.url(),
    sourceType: z.enum(SOURCE_TYPES),
    sourcePublishedAt: z.string().optional(),
  })
  .superRefine((row, context) => {
    if (!isOfficialUrl(row.sourceUrl, row.sourceType)) {
      context.addIssue({ code: "custom", path: ["sourceUrl"], message: "A fonte tem de ser um domínio oficial." });
    }
  });

export type DecisionRow = z.infer<typeof decisionRowSchema>;

export type RowError = { row: number; message: string };

export function parseRows(fileName: string, content: string): Record<string, unknown>[] {
  if (fileName.toLowerCase().endsWith(".json")) {
    const data: unknown = JSON.parse(content);
    if (!Array.isArray(data)) throw new Error("O JSON tem de ser uma lista de registos.");
    return data as Record<string, unknown>[];
  }
  return parse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true });
}

export function validateDecisionRows(rows: Record<string, unknown>[]): { valid: DecisionRow[]; errors: RowError[] } {
  const valid: DecisionRow[] = [];
  const errors: RowError[] = [];
  rows.forEach((row, index) => {
    const result = decisionRowSchema.safeParse(row);
    if (result.success) valid.push(result.data);
    else {
      errors.push({
        row: index + 1,
        message: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      });
    }
  });
  return { valid, errors };
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");
}
