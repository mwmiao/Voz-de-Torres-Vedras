import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:1400";
  const [issues, officials] = await Promise.all([
    db.issue.findMany({ where: { status: "ATIVO", isExample: false }, select: { slug: true, updatedAt: true } }),
    db.official.findMany({ where: { active: true }, select: { slug: true } }),
  ]);
  return [
    ...["", "/temas", "/temas/emergentes", "/registo", "/camara", "/fontes", "/transparencia", "/metodo", "/visita-guiada", "/privacidade"].map((path) => ({ url: `${base}${path}` })),
    ...issues.map((issue) => ({ url: `${base}/temas/${issue.slug}`, lastModified: issue.updatedAt })),
    ...officials.map((official) => ({ url: `${base}/camara/${official.slug}` })),
  ];
}
