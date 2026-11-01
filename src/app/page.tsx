import type { Body, Meeting, Source, UpdateCategory } from "@prisma/client";
import Link from "next/link";
import { DecisionList } from "@/components/DecisionTable";
import { KindLabel, LastUpdated } from "@/components/labels";
import { SourceChips } from "@/components/Receipts";
import { db } from "@/lib/db";
import { SOURCED_DECISION } from "@/lib/filters";
import { BODY_LABEL, formatDate, formatEur, formatNumber, formatTime, UPDATE_CATEGORY_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

const RULES: Record<Body, { cadence: string; publicInfo: string; sourceUrl: string; sourceLabel: string }> = {
  ASSEMBLEIA_MUNICIPAL: {
    cadence: "Sessões ordinárias em fevereiro, abril, junho, setembro e novembro ou dezembro.",
    publicInfo: "Qualquer cidadão com idade eleitoral pode intervir, inscrevendo-se no início da sessão.",
    sourceUrl: "https://www.am-tvedras.pt/sessoes/participacao-publica/",
    sourceLabel: "Regras da Assembleia Municipal",
  },
  EXECUTIVO_MUNICIPAL: {
    cadence: "Reuniões ordinárias quinzenais, às terças-feiras, em regra às 9h30. A última de cada mês é pública.",
    publicInfo: "Nas reuniões públicas, a inscrição para intervir faz-se no início do período de intervenção do público.",
    sourceUrl: "https://www.cm-tvedras.pt/documentos/editaisatas/editaiscm?id=3377",
    sourceLabel: "Edital n.º 149/2026",
  },
};

type MeetingWithSources = Meeting & { sources: Source[] };

function MeetingCard({ body, next, last }: { body: Body; next?: MeetingWithSources | null; last?: MeetingWithSources | null }) {
  const rule = RULES[body];
  const shown = next ?? last;
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
          Última reunião registada: <Link href={`/reunioes/${last.slug}`} className="underline">{formatDate(last.date)}</Link>{last.location ? `, ${last.location}` : ""}.
        </p>
      ) : null}
      <p className="mt-3 text-sm">
        {rule.publicInfo} <a href={rule.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{rule.sourceLabel}</a>
      </p>
      {shown ? (
        <div className="mt-3">
          <SourceChips sources={shown.sources} />
          <LastUpdated date={shown.updatedAt} className="mt-2" />
        </div>
      ) : null}
    </article>
  );
}

export default async function Home() {
  const now = new Date();
  const meetingArgs = { include: { sources: true } };
  const [nextAm, nextCm, lastAm, lastCm, decisions, decisionCount, contractStats, sourceCount, cash, issues, updates] = await Promise.all([
    db.meeting.findFirst({ ...meetingArgs, where: { body: "ASSEMBLEIA_MUNICIPAL", date: { gte: now } }, orderBy: { date: "asc" } }),
    db.meeting.findFirst({ ...meetingArgs, where: { body: "EXECUTIVO_MUNICIPAL", date: { gte: now } }, orderBy: { date: "asc" } }),
    db.meeting.findFirst({ ...meetingArgs, where: { body: "ASSEMBLEIA_MUNICIPAL", date: { lt: now } }, orderBy: { date: "desc" } }),
    db.meeting.findFirst({ ...meetingArgs, where: { body: "EXECUTIVO_MUNICIPAL", date: { lt: now } }, orderBy: { date: "desc" } }),
    db.decision.findMany({
      where: { ...SOURCED_DECISION, outcome: { notIn: ["POR_PUBLICAR", "TOMADA_CONHECIMENTO"] } },
      include: { meeting: true, sources: { where: { official: true } } },
      orderBy: [{ meeting: { date: "desc" } }, { id: "asc" }],
      take: 5,
    }),
    db.decision.count({ where: SOURCED_DECISION }),
    db.contract.aggregate({ _count: { _all: true }, _sum: { priceEur: true }, _max: { updatedAt: true } }),
    db.source.count(),
    db.budgetEntry.findFirst({ where: { label: "Total de disponibilidades" }, orderBy: { asOf: "desc" } }),
    db.issue.findMany({ orderBy: { title: "asc" }, take: 4 }),
    // Por categoria, para que uma série de documentos não esconda contratos ou reuniões.
    Promise.all(
      (Object.keys(UPDATE_CATEGORY_LABEL) as UpdateCategory[]).map((category) =>
        db.updateEvent.findMany({ where: { category }, orderBy: { occurredAt: "desc" }, take: 3 }),
      ),
    ),
  ]);
  const recent = updates.flat().sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  const stats = [
    { label: "Decisões no Registo", value: formatNumber(decisionCount), href: "/reunioes" },
    { label: "Contratos de 2026", value: formatNumber(contractStats._count._all), href: "/contratos" },
    { label: "Valor contratual somado", value: formatEur(contractStats._sum.priceEur ?? 0), href: "/contratos" },
    { label: "Fontes registadas", value: formatNumber(sourceCount), href: "/fontes" },
  ];

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">
          <p className="text-sm font-semibold tracking-wide text-record">Registos · Dados · Fontes</p>
          <h1 className="mt-3 max-w-4xl font-serif text-4xl font-semibold leading-tight md:text-6xl">
            Dados públicos de Torres Vedras, com fontes oficiais.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Orçamento, contratos, reuniões, decisões e eleitos municipais num só lugar. Cada informação liga ao documento oficial de origem.
          </p>
          <nav aria-label="Atalhos" className="mt-7 flex flex-wrap gap-2">
            <Link href="/reunioes" className="btn no-underline">Reuniões e decisões</Link>
            {[["/orcamento", "Orçamento"], ["/contratos", "Contratos"], ["/camara", "Câmara"], ["/fontes", "Fontes"]].map(([href, label]) => (
              <Link key={href} href={href} className="btn-quiet no-underline">{label}</Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-3">
        <div>
          <h2 className="font-serif text-xl font-semibold">Registos</h2>
          <p className="mt-1 text-sm text-muted">Decisões, reuniões, agendas, atas e votos da Assembleia Municipal e do Executivo Municipal.</p>
        </div>
        <div>
          <h2 className="font-serif text-xl font-semibold">Dados</h2>
          <p className="mt-1 text-sm text-muted">Orçamento, despesa, contratos públicos, fornecedores e projetos municipais.</p>
        </div>
        <div>
          <h2 className="font-serif text-xl font-semibold">Fontes</h2>
          <p className="mt-1 text-sm text-muted">Cada informação liga a uma fonte oficial. Sem fonte oficial, não é apresentada como facto.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4" aria-label="Números">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-line bg-surface p-4">
              <dt className="text-sm text-muted">{stat.label}</dt>
              <dd className="mt-1 font-serif text-2xl font-semibold tabular-nums"><Link href={stat.href} className="no-underline hover:underline">{stat.value}</Link></dd>
            </div>
          ))}
        </dl>
        {cash ? (
          <p className="mt-3 text-sm text-muted">
            Disponibilidades do Município a {formatDate(cash.asOf!)}: {formatEur(cash.amountEur)}. <Link href="/orcamento" className="underline">Ver situação financeira</Link>
          </p>
        ) : null}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="esta-semana">
        <h2 id="esta-semana" className="font-serif text-2xl font-semibold">Esta semana em Torres Vedras</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <MeetingCard body="ASSEMBLEIA_MUNICIPAL" next={nextAm} last={lastAm} />
          <MeetingCard body="EXECUTIVO_MUNICIPAL" next={nextCm} last={lastCm} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10" aria-labelledby="atualizacoes">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="atualizacoes" className="font-serif text-2xl font-semibold">Atualizações recentes</h2>
          <Link href="/estado-das-fontes" className="text-sm underline">Estado das fontes</Link>
        </div>
        {recent.length > 0 ? (
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-surface">
            {recent.map((update) => (
              <li key={update.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <span className="mr-2 inline-block rounded bg-record-soft px-1.5 py-0.5 text-xs font-semibold text-record">
                    {UPDATE_CATEGORY_LABEL[update.category]}{update.status === "UPDATED" ? " · alterado" : ""}
                  </span>
                  <a href={update.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline [overflow-wrap:anywhere]">
                    {update.title}
                    <span className="sr-only"> (abre noutra janela)</span>
                  </a>
                </div>
                <time dateTime={update.occurredAt.toISOString()} className="whitespace-nowrap text-xs text-muted">{formatDate(update.occurredAt)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">Ainda não há atualizações registadas.</p>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-2">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <KindLabel kind="REGISTO_OFICIAL" />
            <h2 className="mt-2 font-serif text-2xl font-semibold">Decisões recentes</h2>
          </div>
          <Link href="/reunioes" className="text-sm underline">Ver todas</Link>
        </div>
        <div className="mt-4"><DecisionList decisions={decisions} /></div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-2xl font-semibold">Dossiês</h2>
          <Link href="/dossies" className="text-sm underline">Todos os dossiês</Link>
        </div>
        <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {issues.map((issue) => (
            <li key={issue.id} className="rounded-lg border border-line bg-surface p-4">
              <p className="text-xs font-semibold text-muted">{issue.category}</p>
              <h3 className="mt-1 font-medium"><Link href={`/dossies/${issue.slug}`} className="underline">{issue.title}</Link></h3>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
