import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KindLabel, LastUpdated, PageHead } from "@/components/labels";
import { Receipt, SourceChips } from "@/components/Receipts";
import { db } from "@/lib/db";
import { BODY_LABEL, formatDateShort } from "@/lib/format";

export const dynamic = "force-dynamic";

const CHOICE = { FAVOR: "A favor", CONTRA: "Contra", ABSTENCAO: "Abstenção" };

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const official = await db.official.findUnique({ where: { slug: (await params).slug }, select: { name: true, role: true } });
  return official ? { title: official.name, description: `${official.role}, Torres Vedras.` } : {};
}

export default async function OfficialPage({ params }: Props) {
  const official = await db.official.findUnique({
    where: { slug: (await params).slug },
    include: {
      sources: true,
      memberships: { include: { committee: true } },
      votes: { include: { decision: { include: { meeting: true, sources: { where: { official: true } } } } } },
    },
  });
  if (!official) notFound();

  return (
    <>
      <PageHead title={official.name} kicker={<div className="flex items-center gap-2"><Link href="/camara" className="text-sm underline">Câmara</Link><KindLabel kind="REGISTO_OFICIAL" /></div>}>
        <p>{official.role} · {BODY_LABEL[official.body]}{official.parish ? ` · ${official.parish}` : ""}</p>
        <LastUpdated date={official.updatedAt} className="mt-1" />
      </PageHead>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_21rem]">
        <div className="space-y-7">
          <section>
            <h2 className="font-serif text-xl font-semibold">Partido ou coligação</h2>
            <p className="mt-1">{official.party ?? "Não indicado na fonte consultada."}</p>
          </section>
          {official.portfolios.length > 0 ? (
            <section>
              <h2 className="font-serif text-xl font-semibold">Pelouros</h2>
              <ul className="mt-1 list-disc pl-5">{official.portfolios.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          ) : null}
          {official.memberships.length > 0 ? (
            <section>
              <h2 className="font-serif text-xl font-semibold">Comissões</h2>
              <ul className="mt-1 list-disc pl-5">
                {official.memberships.map(({ committee, isChair }) => <li key={committee.id}>{committee.name}{isChair ? " (presidência)" : ""}</li>)}
              </ul>
            </section>
          ) : null}
          <section>
            <h2 className="font-serif text-xl font-semibold">Sentido de voto publicado</h2>
            {official.votes.length > 0 ? (
              <ul className="mt-2 space-y-3">
                {official.votes.map((vote) => (
                  <li key={vote.id}>
                    <p className="font-medium">{vote.decision.title}</p>
                    <p className="text-sm text-muted">{formatDateShort(vote.decision.meeting.date)} · {CHOICE[vote.choice]}</p>
                    <div className="mt-1"><SourceChips sources={vote.decision.sources} /></div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">Sem votos nominais identificados nos documentos transcritos até agora.</p>
            )}
            <p className="mt-2 text-xs text-muted">Os editais publicam o resultado da votação, não o voto de cada eleito. Aqui só aparece o que a fonte oficial identifica.</p>
          </section>
        </div>
        <aside className="space-y-3">
          <h2 className="font-serif text-lg font-semibold">Fontes</h2>
          {official.sources.map((source) => <Receipt key={source.id} source={source} />)}
        </aside>
      </div>
    </>
  );
}
