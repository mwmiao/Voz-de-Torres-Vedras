import type { Metadata } from "next";
import { KindLabel, PageHead } from "@/components/labels";
import { OfficialBadge, UnverifiedBadge } from "@/components/Receipts";

export const metadata: Metadata = { title: "Método", description: "Como a Voz de Torres Vedras recolhe, verifica e apresenta dados públicos." };

export default function MetodoPage() {
  return (
    <>
      <PageHead title="Método"><p>Registos · Dados · Fontes: informação pública, neutra e verificável.</p></PageHead>
      <div className="prose-civic mx-auto max-w-3xl space-y-8 px-4 py-8">
        <section>
          <h2 className="font-serif text-2xl font-semibold">Dois tipos de conteúdo, sempre separados</h2>
          <ul className="mt-3 space-y-3">
            <li><KindLabel kind="REGISTO_OFICIAL" /> <span className="mt-1 block">Transcrição de atas, editais, vídeos, orçamentos e contratos publicados por entidades públicas.</span></li>
            <li><KindLabel kind="CONTEXTO_EDITORIAL" /> <span className="mt-1 block">Resumos neutros que ajudam a compreender um assunto. Não substituem os documentos.</span></li>
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-semibold">Fontes</h2>
          <p className="mt-2"><OfficialBadge /> indica uma ligação a um documento de uma entidade pública.</p>
          <p><UnverifiedBadge /> indica que não existe fonte oficial: a afirmação fica fora do conteúdo factual, numa área própria.</p>
          <p>Uma decisão sem documento oficial não entra no Registo. Quando a fonte não publica um dado, como a contagem de votos, indicamos isso mesmo e não o estimamos. Valores aproximados na fonte aparecem assinalados com «cerca de».</p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-semibold">Última atualização</h2>
          <p className="mt-2">A data indica quando o registo foi recolhido ou verificado na fonte oficial pela última vez. Não indica quando a entidade pública o alterou.</p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-semibold">Neutralidade</h2>
          <p className="mt-2">Não fazemos acusações, classificações de pessoas nem recomendações de voto. Os dados de contratos são descritivos: um padrão é apenas um ponto de partida para consultar a fonte.</p>
          <p>Encontrou um erro? O documento oficial prevalece sempre sobre esta plataforma.</p>
        </section>
        <section>
          <h2 className="font-serif text-2xl font-semibold">Recolha de dados</h2>
          <p className="mt-2">Usamos apenas informação pública e respeitamos o robots.txt, os termos de utilização e os limites de acesso de cada site. Cada importação guarda a origem, a data de recolha e uma impressão digital do ficheiro.</p>
          <p>Algumas informações ainda estão incompletas. Os mapas completos do orçamento e as deliberações do Executivo constam de PDF que o site da Câmara exclui do acesso automático, pelo que dependem de transcrição.</p>
        </section>
      </div>
    </>
  );
}
