import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireModerator } from "@/lib/auth";

export const metadata: Metadata = { title: "Moderação", robots: { index: false } };
export const dynamic = "force-dynamic";

const LINKS = [
  ["/moderacao", "Resumo"],
  ["/moderacao/propostas", "Propostas"],
  ["/moderacao/temas", "Temas"],
  ["/moderacao/denuncias", "Denúncias e afirmações"],
  ["/moderacao/importacao", "Importação e definições"],
];

export default async function ModeracaoLayout({ children }: { children: ReactNode }) {
  await requireModerator();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-serif text-3xl font-semibold">Moderação</h1>
      <nav aria-label="Moderação" className="mt-3 flex flex-wrap gap-3 border-b border-line pb-3 text-sm">
        {LINKS.map(([href, label]) => <Link key={href} href={href} className="font-medium underline">{label}</Link>)}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
