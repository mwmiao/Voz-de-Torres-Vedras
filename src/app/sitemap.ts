import type { MetadataRoute } from "next";
import { listIssueSlugs } from "@/lib/queries/issues";
import { listMeetingSlugs } from "@/lib/queries/meetings";
import { listOfficialSlugs } from "@/lib/queries/officials";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:1400";
  const [issues, officials, meetings] = await Promise.all([
    listIssueSlugs(),
    listOfficialSlugs(),
    listMeetingSlugs(),
  ]);
  return [
    ...["", "/orcamento", "/contratos", "/reunioes", "/resumos", "/seguranca", "/alertas", "/metricas", "/dossies", "/camara", "/fontes", "/estado-das-fontes", "/metodo", "/privacidade"].map((path) => ({ url: `${base}${path}` })),
    ...issues.map((issue) => ({ url: `${base}/dossies/${issue.slug}`, lastModified: issue.updatedAt })),
    ...meetings.map((meeting) => ({ url: `${base}/reunioes/${meeting.slug}`, lastModified: meeting.updatedAt })),
    ...officials.map((official) => ({ url: `${base}/camara/${official.slug}`, lastModified: official.updatedAt })),
  ];
}
