import type { Metadata } from "next";
import { KindLabel, PageHead } from "@/components/labels";
import { OfficialBadge, UnverifiedBadge } from "@/components/Receipts";
import { getMinPublicCount } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Método", description: "Como a Voz de Torres Vedras separa opinião, registo oficial e contexto, e como verifica fontes." };

export default async function MetodoPage() {
  const minimum = await getMinPublicCount();
  return (
    <>
      <PageHead title="Método"><p>As vozes dos residentes e os registos oficiais do município pertencem lado a lado.</p></PageHead>
      <div className="prose-civic mx-auto max-w-3xl space-y-8 px-4 py-8">
        <section>
          <h2 className="font-serif text-2xl font-semibold">Três tipos de conteúdo, sempre separados</h2>
          <ul className="mt-3 space-y-3">
            <li><KindLabel kind="RESIDENTES" /> <span className="block mt-1">Resultados agregados de quem participa. Não é uma sondagem representativa da população.</span></li>
            <li><KindLabel kind="REGISTO_OFICIAL" /> <span className="block mt-1">Transcrição de atas, editais, vídeos, orçamentos e contratos publicados por entidades públicas.</span></li>
            <li><KindLabel kind="CONTEXTO_EDITORIAL" /> <span className="block mt-1">Resumos neutros que ajudam a compreender um tema. Não substituem os documentos.</span></li>
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-semibold">Fontes</h2>
          <p className="mt-2"><OfficialBadge /> indica uma ligação a um documento de uma entidade pública.</p>
          <p><UnverifiedBadge /> indica que não existe fonte oficial: a afirmação fica fora do conteúdo factual, numa área própria.</p>
          <p>Uma decisão sem documento oficial não entra no Registo. Quando a fonte não publica um dado, como a contagem de votos, indicamos isso mesmo e não o estimamos.</p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-semibold">Uma pessoa, uma voz</h2>
          <p className="mt-2">Cada conta tem uma posição por tema, que pode ser alterada ou removida. Nenhuma participação tem mais destaque do que outra.</p>
          <p>Os resultados de um tema só são publicados a partir de {minimum} posições.</p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-semibold">Neutralidade</h2>
          <p className="mt-2">Não fazemos acusações, classificações de pessoas nem recomendações de voto. Os dados de contratos são descritivos: um padrão é apenas um ponto de partida para consultar a fonte.</p>
          <p>Encontrou um erro? O documento oficial prevalece sempre sobre esta plataforma.</p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-semibold">Recolha de dados</h2>
          <p className="mt-2">Usamos apenas informação pública e respeitamos o robots.txt, os termos de utilização e os limites de acesso de cada site. Cada importação guarda a origem, a data de recolha e uma impressão digital do ficheiro.</p>
        </section>
      </div>
    </>
  );
}
