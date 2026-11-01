export const USER_AGENT = "VozDeTorresVedras/0.1 (plataforma civica; +https://github.com/mwmiao/Voz-de-Torres-Vedras)";

type Rule = { allow: boolean; path: string };

/** Avalia um robots.txt para o grupo `*`: vence a regra mais longa, e Allow em caso de empate. */
export function isAllowedByRobots(robotsTxt: string, path: string): boolean {
  const rules: Rule[] = [];
  let inStarGroup = false;
  let lastWasAgent = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      inStarGroup = lastWasAgent ? inStarGroup || value === "*" : value === "*";
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (inStarGroup && (field === "allow" || field === "disallow") && value) {
      rules.push({ allow: field === "allow", path: value });
    }
  }

  const matching = rules
    .filter((rule) => path.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return matching.length === 0 || matching[0].allow;
}

/** Acesso respeitoso: verifica o robots.txt e recusa caminhos excluídos. */
export async function politeFetch(url: string, fetcher: typeof fetch = fetch): Promise<Response> {
  const target = new URL(url);
  const robots = await fetcher(`${target.origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT } });
  if (robots.ok && !isAllowedByRobots(await robots.text(), target.pathname + target.search)) {
    throw new Error(`Caminho excluído pelo robots.txt: ${url}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const response = await fetcher(url, { headers: { "User-Agent": USER_AGENT } });
  if (response.status === 429 || response.status === 503) {
    throw new Error(`O servidor pediu para abrandar (${response.status}). Tente mais tarde.`);
  }
  if (!response.ok) throw new Error(`Pedido falhou (${response.status}): ${url}`);
  return response;
}
