import type { Body, Outcome, Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { DecisionList } from "@/components/DecisionTable";
import { KindLabel, PageHead } from "@/components/labels";
import { SourceChips } from "@/components/Receipts";
import { db } from "@/lib/db";
import { BODY_LABEL, formatDate, OUTCOME_LABEL } from "@/lib/format";
import { SOURCED_DECISION } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Registo", description: "Linha do tempo pesquisável das decisões da Assembleia Municipal e do Executivo Municipal de Torres Vedras." };

const PAGE_SIZE = 25;

type Search = { q?: string; orgao?: string; resultado?: string; ano?: string; pagina?: string };

export default async function RegistoPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const body = params.orgao && params.orgao in BODY_LABEL ? (params.orgao as Body) : undefined;
  const outcome = params.resultado && params.resultado in OUTCOME_LABEL ? (params.resultado as Outcome) : undefined;
  const year = /^\d{4}$/.test(params.ano ?? "") ? Number(params.ano) : undefined;
  const page = Math.max(1, Number(params.pagina) || 1);

  const where: Prisma.DecisionWhereInput = {
    ...SOURCED_DECISION,
    outcome,
    meeting: {
      body,
      date: year ? { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } : undefined,
    },
    OR: q
      ? [{ title: { contains: q, mode: "insensitive" } }, { proposalRef: { contains: q, mode: "insensitive" } }]
      : undefined,
  };

  const [decisions, total, executiveMeetings] = await Promise.all([
    db.decision.findMany({
      where,
      include: { meeting: true, sources: { where: { official: true } } },
      orderBy: [{ meeting: { date: "desc" } }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.decision.count({ where }),
    db.meeting.findMany({
      where: { body: "EXECUTIVO_MUNICIPAL" },
      include: { sources: { where: { official: true } } },
      orderBy: { date: "desc" },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (target: number) => {
    const query = new URLSearchParams(Object.entries({ ...params, pagina: String(target) }).filter(([, value]) => value) as [string, string][]);
    return `/registo?${query}`;
  };

  return (
    <>
      <PageHead title="Registo" kicker={<KindLabel kind="REGISTO_OFICIAL" />}>
        <p>Decisões municipais, transcritas dos editais e atas. Sem documento oficial, uma decisão não entra no Registo.</p>
      </PageHead>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <form role="search" method="get" className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto_auto]">
          <label className="text-sm font-medium">Pesquisar<input name="q" defaultValue={q} className="field mt-1" placeholder="Título ou proposta" /></label>
          <label className="text-sm font-medium">Órgão
            <select name="orgao" defaultValue={body ?? ""} className="field mt-1">
              <option value="">Todos</option>
              {Object.entries(BODY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Resultado
            <select name="resultado" defaultValue={outcome ?? ""} className="field mt-1">
              <option value="">Todos</option>
              {Object.entries(OUTCOME_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Ano<input name="ano" inputMode="numeric" pattern="\d{4}" defaultValue={year ?? ""} className="field mt-1 lg:w-24" /></label>
          <button type="submit" className="btn self-end">Pesquisar</button>
        </form>

        <p className="mt-5 text-sm text-muted" role="status">{total} {total === 1 ? "decisão" : "decisões"}</p>
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

        <section aria-labelledby="executivo" className="mt-10">
          <h2 id="executivo" className="font-serif text-2xl font-semibold">Reuniões do Executivo Municipal</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            As atas estão disponíveis nas ligações abaixo. As deliberações ponto a ponto ainda não foram transcritas: o site da Câmara exclui os seus PDF do acesso automático, por isso a importação depende de ficheiros preparados pela moderação.
          </p>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
            {executiveMeetings.map((meeting) => (
              <li key={meeting.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className="font-medium">{meeting.title}</p>
                  <p className="text-muted">{formatDate(meeting.date)}{meeting.location ? ` · ${meeting.location}` : ""}</p>
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
