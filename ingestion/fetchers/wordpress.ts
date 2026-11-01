import type { PoliteHttp } from "./http";

const PER_PAGE = 100;

/** Lê todas as páginas de uma lista da API do WordPress. */
export async function wpList<T>(http: PoliteHttp, endpoint: string, params: Record<string, string>): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const query = new URLSearchParams({ ...params, per_page: String(PER_PAGE), page: String(page) });
    const { data, headers } = await http.json<T[]>(`${endpoint}?${query}`);
    items.push(...data);
    const totalPages = Number(headers.get("x-wp-totalpages") ?? 1);
    if (page >= totalPages) return items;
  }
}
