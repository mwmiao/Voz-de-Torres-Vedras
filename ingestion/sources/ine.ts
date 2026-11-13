import { type IngestRecord } from "../types";
import { assertMinimum } from "../validators";
import { CRIME_CATEGORIES, INE_SERIES, ineRows, ineUrl, parseCrimeYear, parsePopulation, type IneResponse } from "../parsers/ine";
import type { Collector, CollectorInput } from "./types";

async function ineData(input: CollectorInput, code: string, year: number, area: string, extra = "") {
  const { data } = await input.http.json<IneResponse[]>(ineUrl(code, year, area, extra));
  return ineRows(data, year);
}

export const collectIneCrime: Collector = async (input) => {
  const records: IngestRecord[] = [];
  const lastYear = input.now.getUTCFullYear() - 1;
  for (let year = 2011; year <= lastYear; year += 1) {
    const counts = INE_SERIES.counts.find((item) => year >= item.from && year <= item.to)!;
    const rates = INE_SERIES.rates.find((item) => year >= item.from && year <= item.to)!;
    const population = INE_SERIES.population.find((item) => year >= item.from && year <= item.to)!;
    try {
      const count = await ineData(input, counts.code, year, counts.area);
      const rate = await ineData(input, rates.code, year, rates.area);
      records.push(...parseCrimeYear({ year, counts: count.rows, rates: rate.rows, countIndicator: counts.code, publishedAt: count.updated }));
    } catch (error) {
      // O ano mais recente pode ainda não estar publicado.
      if (year < lastYear) throw error;
      continue;
    }
    // A estimativa de população é opcional: sem ela, o ano fica sem taxa por habitante.
    const residents = await ineData(input, population.code, year, population.area, "&Dim3=T&Dim4=T").catch(() => null);
    const estimate = residents && parsePopulation(residents.rows, year, population.code, residents.updated);
    if (estimate) records.push(estimate);
  }
  const totals = records.filter((record) => record.kind === "crime" && record.categoryCode === "T");
  assertMinimum(totals, 10, `anos de dados de ${CRIME_CATEGORIES[0].name.toLowerCase()}`);
  return { records };
};
