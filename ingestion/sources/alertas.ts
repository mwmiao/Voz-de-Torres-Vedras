import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { StructureError, type AlertRecord, type IngestRecord } from "../types";
import { assertContains, assertMinimum } from "../validators";
import { DEFAULT_ACTIVE_DAYS, IPMA_API, parseCmCivilProtection, parseCmNoticeDetail, parseCmNoticeList, parseIpmaWarnings, parseSmasDetail, parseSmasList, SMAS, type IpmaWarning } from "../parsers/alertas";
import type { Collector } from "./types";
import { CM } from "./shared";

export const collectIpma: Collector = async ({ http }) => {
  const { data } = await http.json<IpmaWarning[]>(IPMA_API);
  assertMinimum(data, 1, "avisos do IPMA");
  return { records: parseIpmaWarnings(data), complete: true };
};

export const collectCmAvisos: Collector = async (input) => {
  const url = `${CM}/artigos/avisos/`;
  const { body } = await input.http.text(url);
  const list = assertMinimum(parseCmNoticeList(body), 3, "avisos da Câmara");
  const records: IngestRecord[] = [];
  for (const item of list) {
    // Volta a abrir-se cada aviso da lista, porque a Câmara atualiza alguns, como os de trânsito.
    const { body: detail } = await input.http.text(item.url);
    records.push(parseCmNoticeDetail(detail, item, input.now));
  }
  return { records };
};

export const collectCmProciv: Collector = async (input) => {
  const url = `${CM}/outros/prociv/avisos/`;
  const { body } = await input.http.text(url);
  const year = input.now.getUTCFullYear() - 1;
  const records = assertMinimum(parseCmCivilProtection(body, url), 3, "comunicados da Proteção Civil");
  return { records: records.filter((record) => (record.publishedAt?.getUTCFullYear() ?? 0) >= year) };
};

export const collectSmas: Collector = async (input) => {
  const records: IngestRecord[] = [];
  for (const section of ["interrupcoes-programadas", "avisos-de-falha-de-abastecimento", "outros-avisos"]) {
    const { body } = await input.http.text(`${SMAS}/cliente/avisos-e-interrupcoes/${section}`);
    assertContains(body, /An[úu]ncios/, "avisos dos SMAS");
    for (const url of parseSmasList(body)) {
      const { body: detail } = await input.http.text(url);
      const record = parseSmasDetail(detail, url, input.now);
      if (!record) throw new StructureError(`aviso dos SMAS sem o formato esperado: ${url}`);
      records.push(record);
    }
  }
  return { records };
};

export const collectCurated: Collector = async ({ now }) => {
  const file = path.join(process.cwd(), "prisma", "data", "alertas-curados.json");
  if (!existsSync(file)) return { records: [] };
  const items = JSON.parse(readFileSync(file, "utf8")) as (Omit<AlertRecord, "kind" | "key" | "startsAt" | "endsAt" | "publishedAt" | "hasTime" | "hasOfficialEnd" | "areaType"> & { startsAt?: string; endsAt?: string; publishedAt?: string })[];
  const date = (value?: string) => (value ? new Date(value) : null);
  return {
    records: items.map((item) => ({
      ...item,
      kind: "alert" as const,
      key: `curado|${item.sourceUrl}`,
      startsAt: date(item.startsAt),
      endsAt: date(item.endsAt) ?? new Date(now.getTime() + DEFAULT_ACTIVE_DAYS * 86_400_000),
      hasOfficialEnd: Boolean(item.endsAt),
      hasTime: false,
      areaType: item.area.startsWith("Concelho") ? ("CONCELHO" as const) : ("FREGUESIA" as const),
      publishedAt: date(item.publishedAt),
    })),
  };
};
