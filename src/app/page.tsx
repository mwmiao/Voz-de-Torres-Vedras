import type { Body, Meeting, Source } from "@prisma/client";
import Link from "next/link";
import { AggregateResults } from "@/components/AggregateResults";
import { DecisionList } from "@/components/DecisionTable";
import { ExampleBadge, KindLabel } from "@/components/labels";
import { SourceChips } from "@/components/Receipts";
import { db } from "@/lib/db";
import { BODY_LABEL, formatDate, formatTime } from "@/lib/format";
import { getAggregates, SOURCED_DECISION } from "@/lib/queries";

export const dynamic = "force-dynamic";

const RULES: Record<Body, { cadence: string; participation: string; sourceUrl: string; sourceLabel: string }> = {
  ASSEMBLEIA_MUNICIPAL: {
    cadence: "Sessões ordinárias em fevereiro, abril, junho, setembro e novembro ou dezembro.",
    participation: "Qualquer cidadão com idade eleitoral pode intervir, inscrevendo-se no início da sessão. O período aberto ao público dura até 30 minutos nas sessões ordinárias.",
    sourceUrl: "https://www.am-tvedras.pt/sessoes/participacao-publica/",
    sourceLabel: "Participação pública na Assembleia Municipal",
  },
  EXECUTIVO_MUNICIPAL: {
    cadence: "Reuniões ordinárias quinzenais, às terças-feiras, em regra às 9h30. A última de cada mês é pública.",
    participation: "Nas reuniões públicas, a inscrição faz-se no início do período de intervenção do público (até 60 minutos), com nome, contacto e assunto. Cada pessoa dispõe de até 5 minutos.",
    sourceUrl: "https://www.cm-tvedras.pt/documentos/editaisatas/editaiscm?id=3377",
    sourceLabel: "Edital n.º 149/2026",
  },
};

type MeetingWithSources = Meeting & { sources: Source[] };

function MeetingCard({ body, next, last }: { body: Body; next?: MeetingWithSources | null; last?: MeetingWithSources | null }) {
  const rule = RULES[body];
  return (
    <article className="rounded-lg border border-line bg-surface p-5">
      <h3 className="font-serif text-lg font-semibold">{BODY_LABEL[body]}</h3>
      {next ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">Próxima reunião</dt>
          <dd className="font-medium">{formatDate(next.date)}{next.hasTime ? `, ${formatTime(next.date)}` : ""}</dd>
          <dt className="text-muted">Local</dt>
          <dd>{next.location ?? "Por indicar na fonte"}</dd>
          <dt className="text-muted">Agenda</dt>
          <dd>{next.agendaStatus === "PUBLICADA" ? "Publicada" : "Ainda não publicada"}</dd>
        </dl>
      ) : (
        <p className="mt-2 text-sm">
          <strong>Próxima data ainda não publicada.</strong> <span className="text-muted">{rule.cadence}</span>
        </p>
      )}
      {last ? (
        <p className="mt-3 text-sm text-muted">
          Última reunião registada: {formatDate(last.date)}{last.location ? `, ${last.location}` : ""}.
        </p>
      ) : null}
      <p className="mt-3 text-sm">
        <span className="font-semibold">Como participar: </span>{rule.participation}{" "}
        <a href={rule.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{rule.sourceLabel}</a>
      </p>
      {(next ?? last) ? <div className="mt-3"><SourceChips sources={(next ?? last)!.sources} /></div> : null}
    </article>
  );
}

export default async function Home() {
  const now = new Date();
  const meetingArgs = { include: { sources: true } };
  const [nextAm, nextCm, lastAm, lastCm, decisions, issues] = await Promise.all([
    db.meeting.findFirst({ ...meetingArgs, where: { body: "ASSEMBLEIA_MUNICIPAL", date: { gte: now } }, orderBy: { date: "asc" } }),
    db.meeting.findFirst({ ...meetingArgs, where: { body: "EXECUTIVO_MUNICIPAL", date: { gte: now } }, orderBy: { date: "asc" } }),
    db.meeting.findFirst({ ...meetingArgs, where: { body: "ASSEMBLEIA_MUNICIPAL", date: { lt: now } }, orderBy: { date: "desc" } }),
    db.meeting.findFirst({ ...meetingArgs, where: { body: "EXECUTIVO_MUNICIPAL", date: { lt: now } }, orderBy: { date: "desc" } }),
    db.decision.findMany({
      where: { ...SOURCED_DECISION, outcome: { notIn: ["POR_PUBLICAR", "TOMADA_CONHECIMENTO"] } },
      include: { meeting: true, sources: { where: { official: true } } },
      orderBy: [{ meeting: { date: "desc" } }, { itemNumber: "desc" }],
      take: 5,
    }),
    db.issue.findMany({ where: { status: "ATIVO" }, orderBy: [{ isExample: "asc" }, { updatedAt: "desc" }], take: 3 }),
  ]);
  const aggregates = await getAggregates(issues.map((issue) => issue.id));

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">
          <p className="text-sm font-semibold tracking-wide text-record">Posições · Registos · Fontes</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-tight md:text-6xl">
            Diz onde estás. Vê o que foi decidido.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Residentes registam a sua posição sobre temas locais. As decisões oficiais do município aparecem ao lado, com ligação direta às fontes.
          </p>
          <nav aria-label="Atalhos" className="mt-7 flex flex-wrap gap-2">
            <Link href="/temas" className="btn no-underline">Ver temas</Link>
            {[["/registo", "Registo"], ["/camara", "Câmara"], ["/metodo", "Método"], ["/visita-guiada", "Visita guiada"]].map(([href, label]) => (
              <Link key={href} href={href} className="btn-quiet no-underline">{label}</Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-3">
        <div>
          <KindLabel kind="RESIDENTES" />
          <h2 className="mt-2 font-serif text-xl font-semibold">Posições</h2>
          <p className="mt-1 text-sm text-muted">Uma pessoa, uma posição por tema. Cada posição é privada; só se publicam resultados agregados.</p>
        </div>
        <div>
          <KindLabel kind="REGISTO_OFICIAL" />
          <h2 className="mt-2 font-serif text-xl font-semibold">Registos</h2>
          <p className="mt-1 text-sm text-muted">Agendas, votações e deliberações da Assembleia Municipal e do Executivo Municipal.</p>
        </div>
        <div>
          <KindLabel kind="CONTEXTO_EDITORIAL" />
          <h2 className="mt-2 font-serif text-xl font-semibold">Fontes</h2>
          <p className="mt-1 text-sm text-muted">Cada afirmação liga a atas, vídeos, orçamentos ou contratos oficiais. Sem fonte oficial, não é apresentada como facto.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="esta-semana">
        <h2 id="esta-semana" className="font-serif text-2xl font-semibold">Esta semana em Torres Vedras</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <MeetingCard body="ASSEMBLEIA_MUNICIPAL" next={nextAm} last={lastAm} />
          <MeetingCard body="EXECUTIVO_MUNICIPAL" next={nextCm} last={lastCm} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-2xl font-semibold">Temas em aberto</h2>
          <Link href="/temas" className="text-sm underline">Todos os temas</Link>
        </div>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {issues.map((issue) => (
            <li key={issue.id} className="rounded-lg border border-line bg-surface p-5">
              {issue.isExample ? <div className="mb-2"><ExampleBadge /></div> : null}
              <p className="text-xs font-semibold text-muted">{issue.category}</p>
              <h3 className="mt-1 font-medium">
                <Link href={`/temas/${issue.slug}`} className="underline">{issue.title}</Link>
              </h3>
              <div className="mt-3"><AggregateResults aggregate={aggregates.get(issue.id)!} /></div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-2xl font-semibold">Decisões recentes</h2>
          <Link href="/registo" className="text-sm underline">Ver o Registo</Link>
        </div>
        <div className="mt-4"><DecisionList decisions={decisions} /></div>
      </section>
    </>
  );
}
