import type { Body, Meeting } from "@prisma/client";
import Link from "next/link";
import { AlertList, EmptyState, ExternalLink, MetricCard, SectionHead, TrendText } from "@/components/civic";
import { OutcomeBadge } from "@/components/labels";
import { groupAlerts, SEVERITY_ORDER } from "@/lib/alerts";
import { displayTitle } from "@/lib/display-title";
import { BODY_LABEL, formatDate, formatEur, formatNumber, formatTime } from "@/lib/format";
import { latestMetric, metricSeries } from "@/lib/metrics";
import { listActiveAlerts } from "@/lib/queries/alerts";
import { listLatestContracts } from "@/lib/queries/contracts";
import { listLatestCrimeTotals } from "@/lib/queries/crime";
import { findLastMeeting, findNextMeeting, listLatestDecidedDecisions } from "@/lib/queries/meetings";
import { findLatestSummary } from "@/lib/queries/summaries";
import { SUMMARY_TYPE_LABEL } from "@/lib/summaries";
import { compareValues } from "@/lib/trends";

export const dynamic = "force-dynamic";

const TASKS = [
  { href: "/reunioes", title: "O que foi decidido", text: "Reuniões, votos e documentos" },
  { href: "/contratos", title: "Como se gasta o dinheiro", text: "Contratos e orçamento" },
  { href: "/alertas", title: "Alertas atuais", text: "Água, trânsito, tempo e serviços" },
  { href: "/dossies", title: "Assuntos em curso", text: "Dossiês: hospital, habitação, impostos" },
  { href: "/seguranca", title: "Segurança", text: "Ocorrências recentes e crimes por ano" },
];

/** Onde cada órgão publica as convocatórias, para quando a próxima data ainda não foi recolhida. */
const EDITAIS: Record<Body, string> = {
  ASSEMBLEIA_MUNICIPAL: "https://www.am-tvedras.pt/sessoes/editais/",
  EXECUTIVO_MUNICIPAL: "https://www.cm-tvedras.pt/documentos/editaisatas/editaiscm",
};

const HOME_ALERTS = 3;

function NextMeeting({ body, next, last }: { body: Body; next: Meeting | null; last: Meeting | null }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h3 className="font-semibold">{BODY_LABEL[body]}</h3>
      {next ? (
        <p className="mt-1 text-sm">
          Próxima reunião: <Link href={`/reunioes/${next.slug}`} className="underline">{formatDate(next.date)}{next.hasTime ? `, ${formatTime(next.date)}` : ""}</Link>
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">
          Próxima data ainda não publicada. <ExternalLink href={EDITAIS[body]}>Ver editais oficiais</ExternalLink>
        </p>
      )}
      {last ? <p className="mt-1 text-sm">Última reunião: <Link href={`/reunioes/${last.slug}`} className="underline">{formatDate(last.date)}</Link></p> : null}
    </div>
  );
}

export default async function Home() {
  const now = new Date();
  const [alerts, summaries, nextAm, nextCm, lastAm, lastCm, decisions, contracts, crime, contractCount, contractValue, meetingsByYear] = await Promise.all([
    listActiveAlerts(now),
    // Uma de cada tipo, para que uma série de contratos não esconda decisões ou reuniões.
    Promise.all(
      ["decisao", "reuniao", "contrato", "procedimento"].map((entityType) => findLatestSummary(entityType, now)),
    ),
    findNextMeeting("ASSEMBLEIA_MUNICIPAL", now),
    findNextMeeting("EXECUTIVO_MUNICIPAL", now),
    findLastMeeting("ASSEMBLEIA_MUNICIPAL", now),
    findLastMeeting("EXECUTIVO_MUNICIPAL", now),
    listLatestDecidedDecisions(4),
    listLatestContracts(4),
    listLatestCrimeTotals(),
    metricSeries("contratos-numero"),
    metricSeries("contratos-valor"),
    metricSeries("reunioes"),
  ]);

  const updates = summaries.flatMap((summary) => (summary ? [summary] : []));
  // O mesmo aviso publicado por duas entidades conta uma vez. A consulta não tem limite, por isso o total é o das ativas.
  const active = groupAlerts([...alerts].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)));
  const shown = active.slice(0, HOME_ALERTS);
  const year = now.getUTCFullYear();
  const lastYear = String(year - 1);
  const beforeYear = String(year - 2);
  const [latestCrime, previousCrime] = crime;

  return (
    <>
      <h1 className="sr-only">Voz de Torres Vedras: dados públicos de Torres Vedras, com fontes oficiais</h1>
      <section className="mx-auto max-w-6xl px-4 pb-2 pt-6">
        <p className="max-w-3xl font-serif text-xl font-semibold leading-tight md:text-3xl">Dados públicos de Torres Vedras, com fontes oficiais.</p>
        <p className="mt-2 hidden max-w-2xl text-muted sm:block">O que o Município decide e gasta, explicado de forma simples e sempre com o documento de origem.</p>
        <nav aria-label="O que procura?" className="mt-4">
          <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
            {TASKS.map((task) => (
              <li key={task.href}>
                <Link href={task.href} className="task-link">
                  <span className="block font-semibold">{task.title}</span>
                  <span className="block text-sm text-muted">{task.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <section aria-labelledby="alertas-ativos" className="mx-auto max-w-6xl px-4 pt-6">
        <SectionHead
          id="alertas-ativos"
          title={active.length > 0 ? `Alertas ativos (${active.length})` : "Alertas ativos"}
          action={<Link href="/alertas" className="text-sm underline">{active.length > shown.length ? `Ver os ${active.length} alertas` : "Ver alertas e arquivo"}</Link>}
        />
        {shown.length > 0 ? (
          <div className="mt-3"><AlertList alerts={shown.map(({ alert }) => alert)} /></div>
        ) : (
          <p className="mt-2 text-sm text-muted">Sem alertas oficiais ativos para Torres Vedras nas fontes acompanhadas.</p>
        )}
      </section>

      <section aria-labelledby="reunioes-proximas" className="mx-auto max-w-6xl px-4 pt-8">
        <SectionHead id="reunioes-proximas" title="Próximas reuniões" action={<Link href="/reunioes" className="text-sm underline">Ver todas as reuniões</Link>} />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <NextMeeting body="ASSEMBLEIA_MUNICIPAL" next={nextAm} last={lastAm} />
          <NextMeeting body="EXECUTIVO_MUNICIPAL" next={nextCm} last={lastCm} />
        </div>
      </section>

      <section aria-labelledby="ultimas" className="mx-auto max-w-6xl px-4 py-8">
        <SectionHead id="ultimas" title="Últimas atualizações" action={<Link href="/resumos" className="text-sm underline">Ver todos os resumos</Link>} />
        {updates.length > 0 ? (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
            {updates.map((summary) => (
              <li key={summary.id} className="p-4">
                <p className="text-xs font-semibold text-muted">
                  {SUMMARY_TYPE_LABEL[summary.entityType]}{summary.date ? ` · ${formatDate(summary.date)}` : ""}
                </p>
                <p className="mt-1 text-sm">{summary.simple}</p>
                <p className="mt-1 text-sm"><ExternalLink href={summary.sourceUrl}>Fonte oficial<span className="sr-only">: {summary.title}</span></ExternalLink></p>
              </li>
            ))}
          </ul>
        ) : <div className="mt-3"><EmptyState title="Ainda não há resumos." /></div>}
      </section>

      <section aria-labelledby="numeros" className="mx-auto max-w-6xl px-4 pb-8">
        <SectionHead id="numeros" title="Métricas principais" action={<Link href="/metricas" className="text-sm underline">Ver todas as métricas</Link>} />
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={`Contratos celebrados em ${lastYear}`}
            value={formatNumber(latestMetric(contractCount, lastYear) ?? 0)}
            trend={compareValues(latestMetric(contractCount, lastYear), latestMetric(contractCount, beforeYear), beforeYear)}
            href="/contratos"
          />
          <MetricCard
            label={`Valor dos contratos de ${lastYear}`}
            value={formatEur(latestMetric(contractValue, lastYear) ?? 0)}
            trend={compareValues(latestMetric(contractValue, lastYear), latestMetric(contractValue, beforeYear), beforeYear)}
            href="/metricas#contratos"
          />
          <MetricCard label={`Reuniões registadas em ${lastYear}`} value={formatNumber(latestMetric(meetingsByYear, lastYear) ?? 0)} href="/reunioes" />
          {latestCrime?.count ? (
            <MetricCard
              label={`Crimes registados em ${latestCrime.year}`}
              value={formatNumber(latestCrime.count)}
              trend={compareValues(latestCrime.count, previousCrime?.count, String(previousCrime?.year))}
              href="/seguranca"
            />
          ) : null}
        </dl>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-8 md:grid-cols-2">
        <section aria-labelledby="decisoes-recentes" className="min-w-0">
          <SectionHead id="decisoes-recentes" title="Decisões recentes" action={<Link href="/reunioes" className="text-sm underline">Ver todas</Link>} />
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
            {decisions.map((decision) => (
              <li key={decision.id} className="p-3 text-sm">
                <p className="font-medium">{decision.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-muted">
                  <OutcomeBadge outcome={decision.outcome} />
                  <Link href={`/reunioes/${decision.meeting.slug}`} className="underline">{formatDate(decision.meeting.date)}</Link>
                </p>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="contratos-recentes" className="min-w-0">
          <SectionHead id="contratos-recentes" title="Contratos recentes" action={<Link href="/contratos" className="text-sm underline">Ver todos</Link>} />
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
            {contracts.map((contract) => (
              <li key={contract.id} className="p-3 text-sm">
                <p className="font-medium">{displayTitle(contract.title)}</p>
                <p className="mt-1 text-muted">{formatEur(contract.priceEur)}{contract.signedAt ? ` · ${formatDate(contract.signedAt)}` : ""}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {latestCrime?.count ? (
        <section aria-labelledby="seguranca-resumo" className="mx-auto max-w-6xl px-4 pb-8">
          <SectionHead id="seguranca-resumo" title="Segurança" action={<Link href="/seguranca" className="text-sm underline">Ver dados de segurança</Link>} />
          <div className="mt-3 rounded-lg border border-line bg-surface p-4">
            <p className="text-sm">Dados mais recentes: {latestCrime.year}, com {formatNumber(latestCrime.count)} crimes registados no concelho.</p>
            <p className="mt-1"><TrendText trend={compareValues(latestCrime.count, previousCrime?.count, String(previousCrime?.year))} /></p>
            <p className="mt-2 text-sm"><ExternalLink href={latestCrime.sourceUrl}>Fonte oficial: INE e DGPJ</ExternalLink></p>
          </div>
        </section>
      ) : null}
    </>
  );
}
