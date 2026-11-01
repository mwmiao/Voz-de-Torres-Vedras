import { StructureError, type CrimeRecordInput, type PopulationRecord } from "../types";

export const INE_INDICATOR_URL = (code: string) => `https://www.ine.pt/xurl/indx/${code}/PT`;

const API = "https://www.ine.pt/ine/json_indicador/pindica.jsp";

/** Até 2020 os valores estão em NUTS 2013; a partir de 2021, em NUTS 2024, a série mais recente. */
export const INE_SERIES = {
  counts: [
    { code: "0008073", area: "16B1113", from: 2011, to: 2020 },
    { code: "0012261", area: "1D11113", from: 2021, to: 2100 },
  ],
  rates: [
    { code: "0008074", area: "16B1113", from: 2011, to: 2020 },
    { code: "0012260", area: "1D11113", from: 2021, to: 2100 },
  ],
  population: [
    { code: "0008273", area: "16B1113", from: 2011, to: 2020 },
    { code: "0012918", area: "1D11113", from: 2021, to: 2100 },
  ],
} as const;

/** As categorias da taxa têm códigos próprios: aqui ficam nos códigos da contagem. */
const RATE_TO_COUNT: Record<string, string> = { T: "T", "1": "12", "2": "28211_2840", "3": "2831_2832", "4": "41682", "5": "646", "6": "2" };

export const CRIME_CATEGORIES: { code: string; name: string; group: string; order: number }[] = [
  { code: "T", name: "Total de crimes registados", group: "Total", order: 1 },
  { code: "1", name: "Crimes contra as pessoas", group: "Agressões e violência", order: 10 },
  { code: "12", name: "Crimes contra a integridade física", group: "Agressões e violência", order: 11 },
  { code: "127", name: "Ofensa à integridade física voluntária simples", group: "Agressões e violência", order: 12 },
  { code: "12194", name: "Violência doméstica contra cônjuge ou análogos", group: "Violência doméstica", order: 13 },
  { code: "111", name: "Homicídio voluntário consumado", group: "Agressões e violência", order: 14 },
  { code: "2", name: "Crimes contra o património", group: "Furtos e roubos", order: 20 },
  { code: "28211_2840", name: "Roubo por esticão e na via pública", group: "Furtos e roubos", order: 21 },
  { code: "2831_2832", name: "Furto de veículo e em veículo motorizado", group: "Furtos e roubos", order: 22 },
  { code: "41682", name: "Condução com taxa de álcool igual ou superior a 1,2 g/l", group: "Condução", order: 30 },
  { code: "646", name: "Condução sem habilitação legal", group: "Condução", order: 31 },
  { code: "4", name: "Crimes contra a vida em sociedade", group: "Outros", order: 40 },
  { code: "5", name: "Crimes contra o Estado", group: "Outros", order: 41 },
  { code: "3", name: "Crimes contra a identidade cultural e integridade pessoal", group: "Outros", order: 42 },
  { code: "10", name: "Crimes contra animais de companhia", group: "Outros", order: 43 },
  { code: "6", name: "Crimes previstos em legislação avulsa", group: "Outros", order: 44 },
];

export type IneRow = { dim_3?: string; dim_3_t?: string; dim_4?: string; valor?: string; sinal_conv?: string };
export type IneResponse = { DataUltimoAtualizacao?: string; Dados?: Record<string, IneRow[]>; Sucesso?: unknown };

export const ineUrl = (code: string, year: number, area: string, extra = "") =>
  `${API}?op=2&varcd=${code}&Dim1=S7A${year}&Dim2=${area}${extra}&lang=PT`;

export function ineRows(response: IneResponse[], year: number): { rows: IneRow[]; updated: Date | null } {
  const first = response[0];
  if (!first?.Dados) throw new StructureError(`resposta do INE sem dados para ${year}`);
  const updated = first.DataUltimoAtualizacao ? new Date(`${first.DataUltimoAtualizacao}T12:00:00Z`) : null;
  return { rows: first.Dados[String(year)] ?? [], updated };
}

/** Junta contagens e taxas de um ano. «x» é um valor oculto pelo INE por segredo estatístico. */
export function parseCrimeYear(input: {
  year: number;
  counts: IneRow[];
  rates: IneRow[];
  countIndicator: string;
  publishedAt: Date | null;
}): CrimeRecordInput[] {
  const rates = new Map<string, number>();
  for (const row of input.rates) {
    const code = RATE_TO_COUNT[row.dim_3 ?? ""];
    if (code && row.valor !== undefined) rates.set(code, Number(row.valor));
  }
  const known = new Set(CRIME_CATEGORIES.map((category) => category.code));
  return input.counts.flatMap((row) => {
    const code = row.dim_3 ?? "";
    if (!known.has(code)) return [];
    const count = row.valor === undefined ? null : Number(row.valor);
    return [{
      kind: "crime" as const,
      categoryCode: code,
      year: input.year,
      count: count !== null && Number.isFinite(count) ? count : null,
      confidential: count === null,
      officialRate: rates.get(code) ?? null,
      sourceUrl: INE_INDICATOR_URL(input.countIndicator),
      publishedAt: input.publishedAt,
    }];
  });
}

export function parsePopulation(rows: IneRow[], year: number, indicator: string, publishedAt: Date | null): PopulationRecord | null {
  const total = rows.find((row) => (row.dim_3 ?? "T") === "T" && (row.dim_4 ?? "T") === "T");
  const population = Number(total?.valor);
  if (!Number.isInteger(population) || population <= 0) return null;
  return { kind: "population", year, population, sourceUrl: INE_INDICATOR_URL(indicator), publishedAt };
}
