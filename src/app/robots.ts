import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:1400";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/conta", "/moderacao", "/entrar"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
