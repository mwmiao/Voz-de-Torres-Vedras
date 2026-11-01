import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/labels";

export const metadata: Metadata = { title: "Visita guiada", description: "Como usar a Voz de Torres Vedras em cinco passos." };

const STEPS = [
  { title: "Escolha um tema", text: "Cada tema tem um resumo neutro, datas e a fase em que se encontra.", href: "/temas", link: "Abrir Temas" },
  { title: "Veja o que foi decidido", text: "No Registo encontra as deliberações, com o resultado e os documentos oficiais.", href: "/registo", link: "Abrir o Registo" },
  { title: "Confirme na fonte", text: "Cada linha liga ao documento original. Use estas ligações para verificar por si.", href: "/fontes", link: "Abrir Fontes" },
  { title: "Registe a sua posição", text: "Entre com o seu email e escolha uma opção. Pode alterá-la ou removê-la. Só publicamos resultados agregados.", href: "/entrar", link: "Entrar" },
  { title: "Participe também nos canais oficiais", text: "Uma posição aqui não chega aos órgãos municipais. Para intervir, use as reuniões públicas e as sessões da Assembleia.", href: "/", link: "Ver como participar" },
];

export default function VisitaGuiadaPage() {
  return (
    <>
      <PageHead title="Visita guiada"><p>Cinco passos para usar a plataforma.</p></PageHead>
      <ol className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-lg border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-record">Passo {index + 1}</p>
            <h2 className="font-serif text-xl font-semibold">{step.title}</h2>
            <p className="mt-1">{step.text}</p>
            <Link href={step.href} className="mt-2 inline-block underline">{step.link}</Link>
          </li>
        ))}
      </ol>
    </>
  );
}
