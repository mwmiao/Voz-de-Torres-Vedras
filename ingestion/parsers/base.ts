import { baseContractUrl, MUNICIPAL_NIFS, parseDate } from "@/lib/import/base";
import { cleanText } from "../normalizers";
import type { DocumentRecord, ModificationRecord } from "../types";

export type RawAnnouncement = {
  nAnuncio?: string;
  dataPublicacao?: string;
  nifEntidade?: string | number;
  designacaoEntidade?: string;
  descricaoAnuncio?: string;
  url?: string;
  tipoActo?: string;
  tiposContrato?: string[];
  PrecoBase?: string | number;
  modeloAnuncio?: string;
  DataLimitePropostas?: string;
  PecasProcedimento?: string;
};

export type RawModification = {
  idcontrato?: string | number;
  modifContratoFundamento?: string;
  modifContratoTipoAto?: string;
  modifContratoData?: string;
  modifContratoPrecoAlterado?: number | string;
  modifPrazoExecucao?: number | string;
  modifDataPublicacao?: string;
};

export function parseAnnouncements(rows: RawAnnouncement[]): DocumentRecord[] {
  return rows
    .filter((row) => MUNICIPAL_NIFS.includes(String(row.nifEntidade)) && row.url && row.descricaoAnuncio)
    .map((row) => ({
      kind: "document",
      url: row.url!,
      title: `${row.tipoActo ?? "Anúncio"}: ${cleanText(row.descricaoAnuncio!)}`,
      publisher: "Diário da República, via Portal BASE (IMPIC)",
      docType: "CONCURSO",
      category: "CONTRATO",
      publishedAt: parseDate(row.dataPublicacao),
      data: {
        numero: row.nAnuncio,
        entidade: row.designacaoEntidade,
        modelo: row.modeloAnuncio,
        tipos: row.tiposContrato,
        precoBase: row.PrecoBase === undefined ? undefined : Number(row.PrecoBase),
        dataLimite: row.DataLimitePropostas,
        pecas: row.PecasProcedimento,
      },
    }));
}

const firstDate = (value?: string) => parseDate(value?.slice(0, 10));

export function parseModifications(rows: RawModification[], knownIds: Set<string>): ModificationRecord[] {
  return rows
    .filter((row) => knownIds.has(String(row.idcontrato)))
    .map((row) => {
      const baseId = String(row.idcontrato);
      const price = Number(row.modifContratoPrecoAlterado);
      const days = Number(row.modifPrazoExecucao);
      return {
        kind: "modification",
        baseId,
        date: firstDate(row.modifContratoData),
        actType: row.modifContratoTipoAto ?? null,
        grounds: row.modifContratoFundamento ?? null,
        newPriceEur: Number.isFinite(price) && price > 0 ? price : null,
        newDurationDays: Number.isFinite(days) && days > 0 ? Math.round(days) : null,
        publishedAt: firstDate(row.modifDataPublicacao),
        sourceUrl: baseContractUrl(baseId),
      };
    });
}
