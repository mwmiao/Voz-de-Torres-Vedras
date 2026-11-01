import type { CrimeCategory, CrimeRecord } from "@prisma/client";
import { formatNumber } from "./format";
import { compareValues } from "./trends";

export const CRIME_DISCLAIMER = "As estatísticas criminais devem ser interpretadas com cautela e não provam, por si só, alterações reais na segurança pública.";

export const CRIME_LIMITATIONS = [
  "Fonte: crimes registados pelas autoridades policiais, compilados pela Direção-Geral da Política de Justiça e publicados pelo INE.",
  "Cobertura: concelho de Torres Vedras. Os crimes registados aqui podem ter sido cometidos no concelho e participados por qualquer autoridade policial.",
  "Período: valores anuais, de 2011 ao último ano publicado. Não há valores mensais ou trimestrais públicos por concelho.",
  "Por freguesia: não encontrámos dados oficiais publicados por freguesia. Não fazemos estimativas.",
  "Categorias: o INE não publica por concelho categorias como danos, tráfico ou consumo de estupefacientes. Só aparecem as categorias publicadas, com os nomes oficiais.",
  "Valores ocultos: «x» indica um valor oculto pelo INE por segredo estatístico, em geral por ser muito baixo.",
  "Séries: até 2020 usa-se a série NUTS 2013 e, desde 2021, a série NUTS 2024. A área do concelho é a mesma.",
  "Taxas: a taxa do INE é apresentada em permilagem. Nas categorias sem taxa oficial, calculámos crimes por 1 000 residentes com a estimativa de população do INE do ano indicado.",
  "Os números refletem também a disponibilidade para participar, a atividade policial, a evolução da população e alterações na recolha de dados.",
];

export type CrimeRow = CrimeRecord & { category: CrimeCategory };

/** Taxa a mostrar: a oficial, se existir; caso contrário, a calculada aqui. */
export function rateOf(record: Pick<CrimeRecord, "officialRate" | "calculatedRate">): { value: number; official: boolean } | null {
  if (record.officialRate !== null) return { value: record.officialRate, official: true };
  if (record.calculatedRate !== null) return { value: record.calculatedRate, official: false };
  return null;
}

export const formatRate = (value: number) => `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(value)} ‰`;

/** O panorama só descreve o sentido das variações: não explica causas nem compara territórios. */
export function panorama(records: CrimeRow[], population: number | null): string[] {
  const years = [...new Set(records.map((record) => record.year))].sort((a, b) => b - a);
  const [latest, previous] = years;
  if (!latest) return [];
  const find = (code: string, year: number) => records.find((record) => record.categoryCode === code && record.year === year);
  const total = find("T", latest);
  if (!total?.count) return [];
  const sentences = [
    `Em ${latest} foram registados ${formatNumber(total.count)} crimes no concelho de Torres Vedras${population ? `, que tinha cerca de ${formatNumber(population)} residentes` : ""}.`,
  ];
  if (previous) sentences.push(`O total ${compareValues(total.count, find("T", previous)?.count, String(previous)).text}.`);
  if (previous) {
    for (const code of ["12194", "2831_2832", "28211_2840"]) {
      const current = find(code, latest);
      if (current?.count === null || current?.count === undefined) continue;
      sentences.push(`${current.category.name}: ${formatNumber(current.count)} registos, ${compareValues(current.count, find(code, previous)?.count, String(previous)).text}.`);
    }
  }
  return sentences;
}
