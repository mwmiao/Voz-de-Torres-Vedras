import type { Metadata } from "next";
import { PageHead } from "@/components/labels";

export const metadata: Metadata = { title: "Privacidade", description: "Como a Voz de Torres Vedras trata dados pessoais." };

const SECTIONS = [
  { title: "Sem contas nem registo", body: "Todo o conteúdo é público e de acesso livre. Esta plataforma não pede dados pessoais, não tem contas e não usa cookies de sessão, de publicidade ou de análise de terceiros." },
  { title: "Eleitos municipais", body: "Publicamos apenas informação oficial sobre o exercício de funções públicas: nome, cargo, força política, pelouros, comissões e votos quando a fonte os identifica." },
  { title: "Fornecedores", body: "Nos contratos, o nome e o NIF de pessoas singulares não são republicados: a linha remete para o Portal BASE." },
  { title: "Correções", body: "Se encontrar um dado pessoal incorreto ou desatualizado, a referência é sempre a fonte oficial indicada. Pode também apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD)." },
];

export default function PrivacidadePage() {
  return (
    <>
      <PageHead title="Privacidade" />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-serif text-xl font-semibold">{section.title}</h2>
            <p className="mt-1">{section.body}</p>
          </section>
        ))}
      </div>
    </>
  );
}
