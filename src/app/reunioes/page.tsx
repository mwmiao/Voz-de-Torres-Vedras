import type { Metadata } from "next";
import Link from "next/link";
import { DecisionList } from "@/components/DecisionTable";
import { CsvLink, KindLabel, LastUpdated, PageHead } from "@/components/labels";
import { SourceChips } from "@/components/Receipts";
import { db } from "@/lib/db";
import { decisionOrder, decisionWhere, queryString, type SearchParams } from "@/lib/filters";
import { BODY_LABEL, formatDate, OUTCOME_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reuniões e decisões", description: "Reuniões, agendas, atas, votos e decisões da Assembleia Municipal e do Executivo Municipal de Torres Vedras." };

const PAGE_SIZE = 25;

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
  const pageLink = (target: number) => `/reunioes?${queryString(filters, { pagina: String(target) })}#decisoes`;

  return (
    <>
      <PageHead title="Reuniões e decisões" kicker={<KindLabel kind="REGISTO_OFICIAL" />}>
        <p>Decisões municipais, transcritas dos editais e atas. Sem documento oficial, uma decisão não entra no Registo.</p>
      </PageHead>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="mb-4 text-sm"><Link href="/dossies" className="underline">Ver decisões organizadas por dossiê</Link></p>
        <form role="search" method="get" className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto_1fr_auto]">
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
          <label className="text-sm font-medium">Ano<input name="ano" inputMode="numeric" pattern="\d{4}" defaultValue={params.ano ?? ""} className="field mt-1 lg:w-24" /></label>
          <label className="text-sm font-medium">Ordenar
            <select name="ordem" defaultValue={params.ordem ?? ""} className="field mt-1">
              <option value="">Mais recentes</option>
              <option value="antigas">Mais antigas</option>
              <option value="titulo">Título</option>
            </select>
          </label>
          <button type="submit" className="btn self-end">Pesquisar</button>
        </form>

        <div id="decisoes" className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted" role="status">{total} {total === 1 ? "decisão" : "decisões"}</p>
            <LastUpdated date={updated._max.updatedAt} />
          </div>
          <CsvLink href={`/dados/decisoes.csv?${queryString(filters)}`} />
        </div>
        <div className="mt-2">
          {decisions.length > 0 ? <DecisionList decisions={decisions} /> : <p className="rounded-lg border border-line bg-surface p-4">Nenhuma decisão corresponde à pesquisa.</p>}
        </div>
        {pages > 1 ? (
          <nav aria-label="Páginas" className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? <Link href={pageLink(page - 1)} className="underline">Anterior</Link> : <span />}
            <span className="text-muted">Página {page} de {pages}</span>
            {page < pages ? <Link href={pageLink(page + 1)} className="underline">Seguinte</Link> : <span />}
          </nav>
        ) : null}

        <section aria-labelledby="reunioes" className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="reunioes" className="font-serif text-2xl font-semibold">Reuniões</h2>
            <CsvLink href="/dados/reunioes.csv" />
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            As deliberações do Executivo Municipal ainda não foram transcritas ponto a ponto: o site da Câmara exclui os seus PDF do acesso automático. As atas estão disponíveis nas ligações de cada reunião.
          </p>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
            {meetings.map((meeting) => (
              <li key={meeting.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <Link href={`/reunioes/${meeting.slug}`} className="font-medium underline">{meeting.title}</Link>
                  <p className="text-muted">
                    {BODY_LABEL[meeting.body]} · {formatDate(meeting.date)}{meeting.location ? ` · ${meeting.location}` : ""}
                    {meeting._count.decisions > 0 ? ` · ${meeting._count.decisions} pontos` : ""}
                  </p>
                  <LastUpdated date={meeting.updatedAt} />
                </div>
                <SourceChips sources={meeting.sources} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
