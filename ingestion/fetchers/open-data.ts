import { unzipSync } from "fflate";
import { StructureError } from "../types";
import type { PoliteHttp } from "./http";

const DADOS_API = "https://dados.gov.pt/api/1/datasets";

type Resource = { title: string; url: string; last_modified: string };

/** Encontra o ficheiro do ano mais recente disponível num conjunto do IMPIC. */
export async function findYearResource(
  http: PoliteHttp,
  slugFor: (year: number) => string,
  fileFor: (year: number) => RegExp,
  now = new Date(),
): Promise<Resource> {
  const year = now.getUTCFullYear();
  for (const candidate of [year, year - 1]) {
    try {
      const { data } = await http.json<{ resources: Resource[] }>(`${DADOS_API}/${slugFor(year)}/`);
      const resource = data.resources.find((item) => fileFor(candidate).test(item.title));
      if (resource) return resource;
    } catch (error) {
      if (candidate === year - 1) throw error;
    }
  }
  // No início do ano o conjunto ainda pode ter o nome do ano anterior.
  const { data } = await http.json<{ resources: Resource[] }>(`${DADOS_API}/${slugFor(year - 1)}/`);
  const resource = data.resources.find((item) => fileFor(year - 1).test(item.title));
  if (!resource) throw new StructureError(`ficheiro anual não encontrado em ${slugFor(year - 1)}`);
  return resource;
}

export function unzipFirst(zip: Uint8Array): Uint8Array {
  const files = Object.values(unzipSync(zip));
  if (files.length === 0) throw new StructureError("ficheiro comprimido vazio");
  return files[0];
}

/**
 * Percorre um JSON com uma lista de objetos sem o descodificar todo, e só
 * interpreta os objetos que contêm um dos termos. O ficheiro anual de contratos
 * tem centenas de MB, demasiado para um NAS com pouca memória.
 */
export function* filterJsonArray<T>(bytes: Uint8Array, terms: string[]): Generator<T> {
  const encoded = terms.map((term) => new TextEncoder().encode(term));
  const decoder = new TextDecoder();
  const contains = (start: number, end: number) =>
    encoded.some((term) => {
      outer: for (let i = start; i <= end - term.length; i += 1) {
        for (let j = 0; j < term.length; j += 1) if (bytes[i + j] !== term[j]) continue outer;
        return true;
      }
      return false;
    });

  let depth = 0;
  let inString = false;
  let start = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (inString) {
      if (byte === 0x5c) i += 1;
      else if (byte === 0x22) inString = false;
      continue;
    }
    if (byte === 0x22) inString = true;
    else if (byte === 0x7b) {
      if (depth === 0) start = i;
      depth += 1;
    } else if (byte === 0x7d) {
      depth -= 1;
      if (depth === 0 && contains(start, i + 1)) yield JSON.parse(decoder.decode(bytes.subarray(start, i + 1))) as T;
    }
  }
}
