import type { Meeting, Source } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { DecisionList } from "@/components/DecisionTable";
import { CsvLink, KindLabel, LastUpdated, PageHead } from "@/components/labels";
import { Disclosure, EmptyState, Pagination, SectionHead } from "@/components/civic";
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
  const where = decisionWhere(params);

  const [decisions, total, meetings, updated] = await Promise.all([
    db.decision.findMany({
      where,
      include: { meeting: true, sources: { where: { official: true } } },
      orderBy: decisionOrder(params),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.decision.count({ where }),
    db.meeting.findMany({
      include: { sources: { where: { official: true } }, _count: { select: { decisions: true } } },
      orderBy: { date: "desc" },
    }),
    db.decision.aggregate({ _max: { updatedAt: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filters = { ...params, pagina: undefined };
  const filtered = Object.values(filters).some(Boolean);
  const pageLink = (target: number) => `/reunioes?${queryString(filters, { pagina: String(target) })}#decisoes`;
  const summaries = await summaryMap("decisao", decisions.map((decision) => decision.slug));
  const now = new Date();
  const past = meetings.filter((meeting) => meeting.date <= now);
  const upcoming = meetings.filter((meeting) => meeting.date > now).reverse();
  const recent = [...upcoming, ...past.slice(0, RECENT_MEETINGS)];
  const older = past.slice(RECENT_MEETINGS);

  return (
    <>
      <PageHead title="Reuniões e decisões" kicker={<KindLabel kind="REGISTO_OFICIAL" />}>
        <p>O que a Assembleia Municipal e a Câmara discutiram e decidiram. Cada registo liga ao edital, à ata ou ao vídeo oficial.</p>
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <section aria-labelledby="reunioes">
          <SectionHead id="reunioes" title="Reuniões recentes" action={<CsvLink href="/dados/reunioes.csv" />} />
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

        <section aria-labelledby="decisoes">
          <SectionHead id="decisoes" title="Decisões" action={<CsvLink href={`/dados/decisoes.csv?${queryString(filters)}`} />}>
            As deliberações do Executivo Municipal ainda não estão transcritas ponto a ponto, porque o site da Câmara exclui os seus PDF do acesso automático. As atas estão ligadas em cada reunião.
          </SectionHead>
          <Disclosure summary="Pesquisar e filtrar" open={filtered}>
          <form role="search" method="get" action="#decisoes" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto_1fr_auto]">
            <label className="text-sm font-medium">Pesquisar<input name="q" defaultValue={params.q ?? ""} className="field mt-1" placeholder="Título ou proposta" /></label>
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
            <button type="submit" className="btn self-end">Pesquisar</button>
          </form>
        </Disclosure>
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
