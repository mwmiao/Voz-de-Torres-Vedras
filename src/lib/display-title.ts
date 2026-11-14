/** Nomes que mantêm a capitalização própria quando um título em maiúsculas passa a frase normal. */
const KEEP_CASE = ["Torres Vedras", "SMAS", "Município", "Câmara Municipal", "Assembleia Municipal", "Portugal", "Lisboa", "IPMA", "Santa Cruz"];

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const KEEP_CASE_PATTERNS = KEEP_CASE.map((name) => ({ name, pattern: new RegExp(`(?<!\\p{L})${escape(name)}(?!\\p{L})`, "giu") }));

/**
 * Títulos que a fonte escreve só em maiúsculas passam a frase normal, para se lerem melhor.
 * Os restantes ficam como estão. É só apresentação: o registo e a pesquisa guardam o texto original.
 */
export function displayTitle(title: string): string {
  const letters = title.replace(/[^\p{L}]/gu, "");
  if (letters.length < 8) return title;
  const upper = letters.replace(/[^\p{Lu}]/gu, "").length;
  if (upper / letters.length < 0.7) return title;
  let text = title.toLocaleLowerCase("pt-PT");
  text = text.replace(/(^|[.:|!?]\s+|[[(«“"])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase("pt-PT"));
  text = text.replace(/(?<!\p{L})(en|cm|ic|ip)(\s?\d)/gu, (_, road: string, rest: string) => road.toUpperCase() + rest);
  for (const { name, pattern } of KEEP_CASE_PATTERNS) text = text.replace(pattern, name);
  return text;
}
