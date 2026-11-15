/** Forma comparável do texto: sem acentos nem maiúsculas. */
export function searchKey(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Tamanho máximo de um termo de pesquisa: mais do que isto não é uma pesquisa útil e só encarece a consulta. */
export const MAX_SEARCH_LENGTH = 100;

/** Termo de pesquisa pronto a usar: normalizado, sem espaços nas pontas e limitado a MAX_SEARCH_LENGTH. */
export function searchTerm(value: string | null | undefined): string {
  return searchKey(value).trim().slice(0, MAX_SEARCH_LENGTH).trimEnd();
}
