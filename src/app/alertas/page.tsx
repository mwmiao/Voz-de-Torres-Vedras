import type { AlertSeverity, AlertType, Prisma } from "@prisma/client";
import type { Metadata } from "next";
import { AlertCard, Disclosure, EmptyState, ExternalLink, FilterPanel, Pagination, SectionHead } from "@/components/civic";
import { CsvLink, LastUpdated, PageHead, pageSections } from "@/components/labels";
import { ALERT_TYPE_LABEL, FREGUESIAS, groupAlerts, SEVERITY_LABEL, SEVERITY_ORDER } from "@/lib/alerts";
import { pageNumber, queryString, type SearchParams } from "@/lib/filters";
import { countExpiredAlerts, lastAlertCheck, listActiveAlerts, listExpiredAlerts } from "@/lib/queries/alerts";
import { searchTerm } from "@/lib/search";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Alertas", description: "Avisos oficiais para Torres Vedras: tempo, água, trânsito, proteção civil e serviços municipais." };

const PAGE_SIZE = 12;

const OFFICIAL_PORTALS = [
  { label: "IPMA: avisos meteorológicos", url: "https://www.ipma.pt/pt/otempo/prev-sam/?p=LSB" },
  { label: "ANEPC: avisos à população", url: "https://prociv.gov.pt/pt/avisos-a-populacao/" },
  { label: "Proteção Civil Municipal", url: "https://www.cm-tvedras.pt/outros/prociv/avisos/" },
  { label: "Avisos da Câmara Municipal", url: "https://www.cm-tvedras.pt/artigos/avisos/" },
  { label: "SMAS: avisos e interrupções", url: "https://www.smastv.pt/cliente/avisos-e-interrupcoes" },
];

const SEVERITY_HELP: Record<AlertSeverity, string> = {
  CRITICO: "aviso vermelho do IPMA.",
  IMPORTANTE: "aviso laranja do IPMA ou falha de abastecimento de água.",
  ATENCAO: "aviso amarelo do IPMA, interrupção programada, corte de trânsito ou comunicado da Proteção Civil.",
  INFORMATIVO: "alterações de serviços, consultas públicas e outros avisos municipais.",
};

function alertWhere(params: SearchParams): Prisma.AlertWhereInput {
  const q = searchTerm(params.q);
  const type = params.tipo && params.tipo in ALERT_TYPE_LABEL ? (params.tipo as AlertType) : undefined;
  const severity = params.gravidade && params.gravidade in SEVERITY_LABEL ? (params.gravidade as AlertSeverity) : undefined;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.data ?? "") ? new Date(`${params.data}T23:59:59Z`) : undefined;
  return {
    type,
    severity,
    searchText: q ? { contains: q } : undefined,
    // Um aviso de todo o concelho também abrange cada freguesia.
    ...(params.area ? { OR: [{ geographicArea: { contains: params.area } }, { geographicAreaType: "CONCELHO" }] } : {}),
    publicationDate: date ? { gte: new Date(date.getTime() - 86_400_000), lte: date } : undefined,
  };
}

export default async function AlertasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const now = new Date();
  const page = pageNumber(params.pagina);
  const where = alertWhere(params);
  const [active, archive, archiveTotal, checked] = await Promise.all([
    listActiveAlerts(now, where),
    listExpiredAlerts(now, where, page, PAGE_SIZE),
    countExpiredAlerts(now, where),
    lastAlertCheck(),
  ]);
  const ordered = groupAlerts([...active].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)));
  const archived = groupAlerts(archive);
  const filters = { ...params, pagina: undefined };
  const filtered = Object.values(filters).some(Boolean);
  const pages = Math.max(1, Math.ceil(archiveTotal / PAGE_SIZE));

  const { nav, id: anchor } = pageSections({ ativos: `Ativos (${ordered.length})`, arquivo: `Arquivo (${archiveTotal})` });

  return (
    <>
      <PageHead title="Alertas" sections={nav}>
        <p>Avisos oficiais para Torres Vedras. Só entram avisos de entidades públicas: nunca redes sociais ou relatos não verificados. Em emergência, ligue 112.</p>
        <LastUpdated date={checked._max.lastCheckedAt} className="mt-1" label="Fontes verificadas pela última vez" />
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">

        <FilterPanel clearHref={filtered ? "/alertas" : undefined}>
          <form role="search" method="get" className="grid grid-cols-2 gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr_1fr_auto]">
          <label className="col-span-2 text-sm font-medium lg:col-span-1">Pesquisar<input name="q" defaultValue={params.q ?? ""} className="field mt-1" /></label>
          <label className="text-sm font-medium">Tipo
            <select name="tipo" defaultValue={params.tipo ?? ""} className="field mt-1">
              <option value="">Todos</option>
              {Object.entries(ALERT_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Gravidade
            <select name="gravidade" defaultValue={params.gravidade ?? ""} className="field mt-1">
              <option value="">Todas</option>
              {SEVERITY_ORDER.map((value) => <option key={value} value={value}>{SEVERITY_LABEL[value]}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Área
            <select name="area" defaultValue={params.area ?? ""} className="field mt-1">
              <option value="">Todo o concelho</option>
              {FREGUESIAS.map((freguesia) => <option key={freguesia.slug} value={freguesia.name}>{freguesia.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Data de publicação<input type="date" name="data" defaultValue={params.data ?? ""} className="field mt-1" /></label>
          <button type="submit" className="btn col-span-2 self-end lg:col-span-1">Aplicar</button>
        </form>
        </FilterPanel>

        <section aria-labelledby={anchor.ativos}>
          <SectionHead id={anchor.ativos} title={`Ativos (${ordered.length})`} action={<CsvLink href="/dados/alertas.csv" />} />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {ordered.map(({ alert, also }) => <AlertCard key={alert.id} alert={alert} also={also} />)}
          </div>
          {ordered.length === 0 ? <EmptyState title={filtered ? "Nenhum alerta ativo corresponde aos filtros." : "Sem alertas oficiais ativos neste momento."}>Isto não garante que não existam: consulte também os portais oficiais abaixo.</EmptyState> : null}
        </section>

        <section aria-labelledby={anchor.arquivo}>
          <SectionHead id={anchor.arquivo} title={`Arquivo (${archiveTotal})`}>Avisos terminados, por ordem do mais recente.</SectionHead>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {archived.map(({ alert, also }) => <AlertCard key={alert.id} alert={alert} also={also} />)}
          </div>
          {archive.length === 0 ? <EmptyState title="Sem avisos no arquivo." /> : null}
          <Pagination page={page} pages={pages} link={(target) => `/alertas?${queryString(filters, { pagina: String(target) })}#arquivo`} />
        </section>

        <Disclosure summary="Como ler os alertas">
          <ul className="max-w-3xl list-disc space-y-1 pl-5 text-sm">
            {SEVERITY_ORDER.map((severity) => <li key={severity}><strong>{SEVERITY_LABEL[severity]}:</strong> {SEVERITY_HELP[severity]}</li>)}
            <li>A gravidade é uma classificação desta plataforma, baseada no tipo de aviso. Não é atribuída pela entidade que o publica, exceto a cor do IPMA.</li>
            <li>Sem data de fim na fonte, um aviso municipal fica nos ativos durante 14 dias e um comunicado da Proteção Civil durante 3 dias.</li>
            <li>A ANEPC e os transportes não são recolhidos automaticamente: consulte diretamente as páginas oficiais.</li>
          </ul>
          <h3 className="mt-3 text-sm font-semibold">Portais oficiais</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {OFFICIAL_PORTALS.map((portal) => <li key={portal.url}><ExternalLink href={portal.url}>{portal.label}</ExternalLink></li>)}
          </ul>
        </Disclosure>
      </div>
    </>
  );
}
