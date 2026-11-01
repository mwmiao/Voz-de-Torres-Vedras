import type { Metadata } from "next";
import { PageHead } from "@/components/labels";

export const metadata: Metadata = { title: "Privacidade", description: "Como a Voz de Torres Vedras trata dados pessoais." };

const SECTIONS = [
  { title: "Que dados guardamos", body: "Um valor irreversível derivado do seu email, as suas posições, propostas e apoios, e datas de atividade. O endereço de email é usado para enviar a ligação de entrada e não fica guardado em claro. O endereço IP é transformado num valor que muda todos os dias, usado apenas em limites de utilização." },
  { title: "Dados sensíveis", body: "Uma posição sobre um tema municipal pode revelar opiniões políticas, que têm proteção reforçada no RGPD. Por isso, o tratamento assenta no seu consentimento explícito, dado ao entrar, que pode retirar em qualquer momento apagando a conta." },
  { title: "O que é público", body: "Apenas resultados agregados, e só a partir de um número mínimo de posições. Nunca publicamos quem respondeu nem o que cada pessoa escolheu." },
  { title: "Os seus direitos", body: "Na sua conta pode consultar e descarregar os seus dados, alterar ou remover posições e apagar a conta, o que elimina as suas posições e apoios. As propostas já publicadas deixam de estar associadas a si." },
  { title: "Autoridade de controlo", body: "Pode apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD)." },
  { title: "Cookies", body: "Usamos apenas um cookie técnico para manter a sessão. Não usamos cookies de publicidade nem ferramentas de análise de terceiros." },
];

export default function PrivacidadePage() {
  return (
    <>
      <PageHead title="Privacidade e dados pessoais" />
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
