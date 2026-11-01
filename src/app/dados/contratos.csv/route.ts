import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { contractOrder, contractWhere, searchParamsObject } from "@/lib/filters";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = searchParamsObject(request.url);
  const contracts = await db.contract.findMany({
    where: contractWhere(params),
    include: { sources: true },
    orderBy: contractOrder(params),
  });
  const rows = contracts.map((contract) => [
    contract.signedAt,
    contract.title,
    contract.awardingBody,
    contract.supplierName,
    contract.supplierNif,
    contract.procedureType,
    contract.contractType,
    contract.cpvCode,
    contract.cpvLabel,
    contract.priceEur.toString().replace(".", ","),
    contract.durationDays,
    contract.sources.map((source) => source.url).join(" "),
    contract.updatedAt,
  ]);
  return csvResponse(
    "contratos-torres-vedras.csv",
    toCsv(
      ["Data do contrato", "Objeto", "Entidade adjudicante", "Fornecedor", "NIF do fornecedor", "Procedimento", "Tipo de contrato", "CPV", "Categoria CPV", "Valor (EUR)", "Prazo (dias)", "Fonte oficial", "Última atualização"],
      rows,
    ),
  );
}
