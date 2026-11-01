import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/registo", destination: "/reunioes", permanent: true },
      { source: "/transparencia", destination: "/contratos", permanent: true },
      { source: "/temas", destination: "/dossies", permanent: true },
      { source: "/temas/:slug", destination: "/dossies/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
