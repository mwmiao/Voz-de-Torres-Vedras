import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isAllowedByRobots, USER_AGENT } from "@/lib/robots";

const TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;
const RETRIES = 3;

type CacheEntry = { etag?: string; lastModified?: string; hash: string };
type FetchOptions = {
  /** API ou ficheiro oficial publicado para reutilização: um robots.txt indisponível não bloqueia. */
  api?: boolean;
  timeoutMs?: number;
  /** Para páginas, envia pedidos condicionais e guarda a impressão digital do conteúdo. */
  cache?: boolean;
};

export type TextResult = { body: string; hash: string; notModified: boolean };

/** Alguns sites antigos anunciam UTF-8 mas enviam Windows-1252: sem isto, os acentos perdem-se. */
export function decodeBody(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function sha256(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Cliente HTTP respeitoso: robots.txt, identificação, intervalo por domínio e novas tentativas. */
export class PoliteHttp {
  private robots = new Map<string, string | null>();
  private lastRequest = new Map<string, number>();
  private readonly cacheFile: string;
  private cache: Record<string, CacheEntry>;

  constructor(
    private readonly delayMs = Number(process.env.INGEST_DELAY_MS ?? 1500),
    private readonly fetcher: typeof fetch = fetch,
    cacheDir = path.join(process.cwd(), "data", "cache"),
  ) {
    mkdirSync(cacheDir, { recursive: true });
    this.cacheFile = path.join(cacheDir, "http.json");
    this.cache = existsSync(this.cacheFile) ? JSON.parse(readFileSync(this.cacheFile, "utf8")) : {};
  }

  saveCache() {
    writeFileSync(this.cacheFile, JSON.stringify(this.cache));
  }

  private async pause(origin: string) {
    const wait = (this.lastRequest.get(origin) ?? 0) + this.delayMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequest.set(origin, Date.now());
  }

  private async assertAllowed(target: URL, api: boolean) {
    if (!this.robots.has(target.origin)) {
      await this.pause(target.origin);
      try {
        const response = await this.fetcher(`${target.origin}/robots.txt`, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        // 404 significa sem restrições. Noutros erros não sabemos quais são as regras.
        if (response.ok) this.robots.set(target.origin, await response.text());
        else this.robots.set(target.origin, response.status === 404 ? "" : null);
      } catch {
        this.robots.set(target.origin, null);
      }
    }
    const rules = this.robots.get(target.origin);
    if (rules === null) {
      if (api) return;
      throw new Error(`Não foi possível ler o robots.txt de ${target.origin}: recolha cancelada.`);
    }
    if (!isAllowedByRobots(rules ?? "", target.pathname + target.search)) {
      throw new Error(`Caminho excluído pelo robots.txt: ${target.href}`);
    }
  }

  private async request(url: string, options: FetchOptions): Promise<Response> {
    const target = new URL(url);
    await this.assertAllowed(target, options.api ?? false);

    const cached = options.cache ? this.cache[url] : undefined;
    const headers: Record<string, string> = { "User-Agent": USER_AGENT };
    if (cached?.etag) headers["If-None-Match"] = cached.etag;
    if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;

    let lastError: unknown;
    for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
      await this.pause(target.origin);
      try {
        const response = await this.fetcher(url, {
          headers,
          signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
        });
        if (response.ok || response.status === 304) return response;
        if (response.status === 429 || response.status === 503) {
          // O servidor pediu para abrandar: não se insiste nesta execução.
          throw new Error(`O servidor pediu para abrandar (${response.status}): ${url}`);
        }
        if (response.status < 500) throw new Error(`Pedido recusado (${response.status}): ${url}`);
        lastError = new Error(`Erro do servidor (${response.status}): ${url}`);
      } catch (error) {
        if (error instanceof Error && /abrandar|recusado/.test(error.message)) throw error;
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, this.delayMs * 2 ** attempt));
    }
    throw lastError instanceof Error ? lastError : new Error(`Pedido falhou: ${url}`);
  }

  async text(url: string, options: FetchOptions = {}): Promise<TextResult> {
    const response = await this.request(url, options);
    const previous = this.cache[url];
    if (response.status === 304 && previous) return { body: "", hash: previous.hash, notModified: true };
    const body = decodeBody(await response.arrayBuffer());
    const hash = sha256(body);
    const notModified = Boolean(options.cache && previous?.hash === hash);
    if (options.cache) {
      this.cache[url] = {
        hash,
        etag: response.headers.get("etag") ?? undefined,
        lastModified: response.headers.get("last-modified") ?? undefined,
      };
    }
    return { body, hash, notModified };
  }

  async json<T>(url: string, options: FetchOptions = {}): Promise<{ data: T; headers: Headers }> {
    const response = await this.request(url, { api: true, ...options });
    return { data: (await response.json()) as T, headers: response.headers };
  }

  /** A ligação pode cair a meio de um ficheiro grande, por isso a leitura do corpo também é repetida. */
  async bytes(url: string, options: FetchOptions = {}): Promise<Uint8Array> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
      try {
        const response = await this.request(url, { timeoutMs: DOWNLOAD_TIMEOUT_MS, ...options });
        return new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        if (error instanceof Error && /abrandar|recusado|robots/.test(error.message)) throw error;
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Download falhou: ${url}`);
  }
}
