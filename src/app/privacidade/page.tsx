import type { Metadata } from "next";
import { PageHead } from "@/components/labels";

export const metadata: Metadata = { title: "Privacidade", description: "Como a Voz de Torres Vedras trata dados pessoais." };

const SECTIONS = [
  { title: "Sem contas nem registo", body: "Todo o conteúdo é público e de acesso livre. Esta plataforma não pede dados pessoais, não tem contas e não usa cookies de sessão, de publicidade ou de análise de terceiros." },
  { title: "Eleitos municipais", body: "Publicamos apenas informação oficial sobre o exercício de funções públicas: nome, cargo, força política, pelouros, comissões e votos quando a fonte os identifica." },
  { title: "Fornecedores", body: "Nos contratos, o nome e o NIF de pessoas singulares não são republicados: a linha remete para o Portal BASE." },
  { title: "Ocorrências recentes", body: "O mapa de ocorrências nunca publica moradas, nem nomes, idades, matrículas ou outros dados de vítimas, suspeitos, testemunhas ou menores. Os resumos são escritos a partir de modelos neutros e a localização é sempre aproximada. Em casos de violência doméstica, só é indicada a freguesia." },
  { title: "Redes sociais e fontes locais", body: "Publicações em redes sociais e páginas comunitárias podem ser usadas, mas aparecem como «Não confirmado» ou «Em apuramento». O texto das publicações não é guardado nem republicado. Contas pessoais não são identificadas, e a ligação não é publicada quando a publicação expõe dados pessoais ou está num grupo fechado. Casos com menores ou violência doméstica vindos destas fontes só aparecem depois de revistos por uma pessoa." },
  { title: "Mapa de fundo", body: "Na página Segurança, as imagens do mapa são pedidas aos servidores do OpenStreetMap, que recebem o endereço IP do seu dispositivo, como em qualquer pedido na Internet. Não são usados cookies. A lista de ocorrências, abaixo do mapa, tem a mesma informação." },
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
