import type { NextConfig } from "next";

// Static headers cannot carry per-request nonces, so scripts/styles allow 'unsafe-inline'
// (Next injects inline bootstrap scripts). A nonce-based policy would force every page to
// render dynamically; see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
