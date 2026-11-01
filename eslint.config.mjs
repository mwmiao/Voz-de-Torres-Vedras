import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { rules: { "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }] } },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "prisma/data/**", "data/**"] },
];

export default config;
