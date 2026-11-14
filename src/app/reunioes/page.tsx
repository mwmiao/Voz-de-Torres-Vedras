import type { Meeting, Prisma, Source } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { DecisionList } from "@/components/DecisionTable";
import { CsvLink, KindLabel, LastUpdated, PageHead, pageSections } from "@/components/labels";
import { Disclosure, EmptyState, FilterPanel, Pagination, SectionHead } from "@/components/civic";
import { SourceChips } from "@/components/Receipts";
import { db } from "@/lib/db";
import { decisionOrder, decisionWhere, queryString, type SearchParams } from "@/lib/filters";
import { BODY_LABEL, formatDate, OUTCOME_LABEL } from "@/lib/format";
import { summaryMap } from "@/lib/summary-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reuniões e decisões", description: "Reuniões, agendas, atas, votos e decisões da Assembleia Municipal e do Executivo Municipal de Torres Vedras." };

const PAGE_SIZE = 25;
const RECENT_MEETINGS = 6;

type MeetingRow = Meeting & { sources: Source[]; _count: { decisions: number } };

function MeetingItem({ meeting }: { meeting: MeetingRow }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
      <div className="min-w-0">
        <Link href={`/reunioes/${meeting.slug}`} className="font-medium underline">{meeting.title}</Link>
        <p className="text-muted">
          {BODY_LABEL[meeting.body]} · {formatDate(meeting.date)}{meeting.location ? ` · ${meeting.location}` : ""}
          {meeting._count.decisions > 0 ? ` · ${meeting._count.decisions} pontos` : ""}
        </p>
      </div>
      <SourceChips sources={meeting.sources} />
    </li>
  );
}

export default async function ReunioesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.pagina) || 1);
  const base = decisionWhere(params);
  // Por omissão, primeiro o que já tem resultado: os pontos à espera de ata ficam num separador próprio.
  const view = params.resultado || params.vista === "todas" ? "todas" : params.vista === "aguardar" ? "aguardar" : "resultado";
  const WITH_RESULT: Prisma.DecisionWhereInput = { outcome: { not: "POR_PUBLICAR" } };
  const WAITING: Prisma.DecisionWhereInput = { outcome: "POR_PUBLICAR" };
  const where: Prisma.DecisionWhereInput = view === "todas" ? base : { AND: [base, view === "aguardar" ? WAITING : WITH_RESULT] };

  const [decisions, total, withResult, waiting, meetings, updated] = await Promise.all([
    db.decision.findMany({
      where,
      include: { meeting: true, sources: { where: { official: true } } },
      orderBy: decisionOrder(params),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.decision.count({ where }),
    db.decision.count({ where: { AND: [base, WITH_RESULT] } }),
    db.decision.count({ where: { AND: [base, WAITING] } }),
    db.meeting.findMany({
      include: { sources: { where: { official: true } }, _count: { select: { decisions: true } } },
      orderBy: { date: "desc" },
    }),
    db.decision.aggregate({ _max: { updatedAt: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filters = { ...params, pagina: undefined };
  const filtered = Object.values({ ...filters, vista: undefined }).some(Boolean);
  const tabs = [
    { view: "resultado", label: `Com resultado (${withResult})`, href: `/reunioes?${queryString(filters, { vista: undefined, resultado: undefined })}#decisoes` },
    { view: "aguardar", label: `A aguardar publicação (${waiting})`, href: `/reunioes?${queryString(filters, { vista: "aguardar", resultado: undefined })}#decisoes` },
    { view: "todas", label: `Todas (${withResult + waiting})`, href: `/reunioes?${queryString(filters, { vista: "todas", resultado: undefined })}#decisoes` },
  ];
  const pageLink = (target: number) => `/reunioes?${queryString(filters, { pagina: String(target) })}#decisoes`;
  const summaries = await summaryMap("decisao", decisions.map((decision) => decision.slug));
  const now = new Date();
  const past = meetings.filter((meeting) => meeting.date <= now);
  const upcoming = meetings.filter((meeting) => meeting.date > now).reverse();
  const recent = [...upcoming, ...past.slice(0, RECENT_MEETINGS)];
  const older = past.slice(RECENT_MEETINGS);

  const { nav, id: anchor } = pageSections({ reunioes: "Reuniões", decisoes: "Decisões" });

  return (
    <>
      <PageHead
        title="Reuniões e decisões"
        kicker={<KindLabel kind="REGISTO_OFICIAL" />}
        sections={[...nav, { href: "/dossies", label: "Por assunto (dossiês)" }]}
      >
        <p>O que a Assembleia Municipal e a Câmara discutiram e decidiram. Cada registo liga ao edital, à ata ou ao vídeo oficial.</p>
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <section aria-labelledby={anchor.reunioes}>
          <SectionHead id={anchor.reunioes} title="Reuniões recentes" action={<CsvLink href="/dados/reunioes.csv" />} />
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
            {recent.map((meeting) => <MeetingItem key={meeting.id} meeting={meeting} />)}
          </ul>
          {older.length > 0 ? (
            <div className="mt-3">
              <Disclosure summary={`Reuniões anteriores (${older.length})`}>
                <ul className="divide-y divide-line">
                  {older.map((meeting) => <MeetingItem key={meeting.id} meeting={meeting} />)}
                </ul>
              </Disclosure>
            </div>
          ) : null}
        </section>

        <section aria-labelledby={anchor.decisoes}>
          <SectionHead id={anchor.decisoes} title="Decisões" action={<CsvLink href={`/dados/decisoes.csv?${queryString(filters)}`} />}>
            As deliberações do Executivo Municipal ainda não estão transcritas ponto a ponto, porque o site da Câmara exclui os seus PDF do acesso automático. As atas estão ligadas em cada reunião.
          </SectionHead>
          <div className="mt-3">
          <FilterPanel clearHref={filtered ? "/reunioes#decisoes" : undefined}>
          <form role="search" method="get" action="#decisoes" className="grid grid-cols-2 gap-3 lg:grid-cols-[2fr_1fr_1fr_auto_1fr_auto]">
            {view === "aguardar" ? <input type="hidden" name="vista" value="aguardar" /> : null}
            <label className="col-span-2 text-sm font-medium lg:col-span-1">Pesquisar<input name="q" defaultValue={params.q ?? ""} className="field mt-1" placeholder="Título ou proposta" /></label>
            <label className="text-sm font-medium">Órgão
              <select name="orgao" defaultValue={params.orgao ?? ""} className="field mt-1">
                <option value="">Todos</option>
                {Object.entries(BODY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Resultado
              <select name="resultado" defaultValue={params.resultado ?? ""} className="field mt-1">
                <option value="">Todos</option>
                {Object.entries(OUTCOME_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Ano<input name="ano" inputMode="numeric" pattern="\d{4}" title="Ano com quatro algarismos" defaultValue={params.ano ?? ""} className="field mt-1 lg:w-24" /></label>
            <label className="text-sm font-medium">Ordenar
              <select name="ordem" defaultValue={params.ordem ?? ""} className="field mt-1">
                <option value="">Mais recentes</option>
                <option value="antigas">Mais antigas</option>
                <option value="titulo">Título</option>
              </select>
            </label>
            <button type="submit" className="btn col-span-2 self-end lg:col-span-1">Pesquisar</button>
          </form>
          </FilterPanel>
          </div>
          <nav aria-label="Decisões por estado" className="page-nav mt-3">
            <ul className="flex flex-wrap gap-2">
              {tabs.map((tab) => <li key={tab.view}><Link href={tab.href} aria-current={view === tab.view ? "page" : undefined}>{tab.label}</Link></li>)}
            </ul>
          </nav>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted" role="status">{total} {total === 1 ? "decisão" : "decisões"}</p>
            <LastUpdated date={updated._max.updatedAt} />
          </div>
          <div className="mt-2">
            {decisions.length > 0 ? <DecisionList decisions={decisions} summaries={summaries} /> : <EmptyState title="Nenhuma decisão corresponde à pesquisa."><Link href="/reunioes#decisoes" className="underline">Limpar filtros</Link></EmptyState>}
          </div>
          <Pagination page={page} pages={pages} link={pageLink} />
          <p className="mt-4 text-sm"><Link href="/dossies" className="underline">Ver decisões organizadas por dossiê</Link></p>
        </section>
      </div>
    </>
  );
}
