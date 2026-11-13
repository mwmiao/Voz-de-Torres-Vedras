import { Disclosure, ExternalLink } from "@/components/civic";
import { IncidentExplorer } from "@/components/IncidentExplorer";
import { CsvLink } from "@/components/labels";
import { FREGUESIAS } from "@/lib/alerts";
import { db } from "@/lib/db";
import type { SearchParams } from "@/lib/filters";
import { formatDateTime } from "@/lib/format";
import { formatLongDay } from "@/lib/incident-format";
import { SOURCE_CATALOG } from "@/lib/source-catalog";
import {
  BOUNDARIES_SOURCE,
  clampRange,
  INCIDENT_CATEGORIES,
  METHOD_INTRO,
  publicIncidentWhere,
  REVIEW_DEFAULTS,
  SOURCE_TIER_LABEL,
  VERIFICATION_HELP,
  VERIFICATION_LABEL,
  VERIFICATION_STATUSES,
  visibilityProblem,
  WINDOW_DAYS,
  windowStart,
  windowStartDay,
} from "@/lib/incidents";
import { toPublicIncident } from "@/lib/public-incident";

const INCIDENT_SOURCES = SOURCE_CATALOG.filter((source) => source.group === "ocorrencias").map((source) => source.id);

const POLICY = [
  `Só mostramos ocorrências dos últimos ${WINDOW_DAYS} dias, contados pela data da ocorrência. As mais antigas passam ao arquivo, disponível no CSV, e saem do mapa.`,
  "Cada fonte tem um nível: 1, autoridade oficial; 2, órgão de comunicação social; 3, conta oficial numa rede social; 4, fonte comunitária ou não oficial, como grupos locais, páginas de residentes ou canais públicos.",
  "Uma fonte oficial torna a ocorrência «Confirmado». A imprensa torna-a «Reportado». Uma ocorrência que surge numa rede social ou página comunitária só passa a «Reportado» com duas redações independentes, e só passa a «Confirmado» com uma fonte oficial.",
  "Repetição não é confirmação: várias contas a partilhar a mesma publicação contam como uma só fonte, e as notícias da agência Lusa republicadas por várias redações contam como uma.",
  "Quando as fontes divergem em factos essenciais, como o tipo, o local ou o dia, a ocorrência fica «Não confirmado», com o aviso de que existem relatos contraditórios.",
  `Ocorrências não confirmadas são arquivadas ao fim de ${REVIEW_DEFAULTS.unconfirmedArchiveDays} dias, quando a publicação original é apagada ou quando uma fonte oficial as contradiz.`,
  "Alegações graves, casos que envolvam violência, menores ou violência doméstica, conflitos entre fontes e publicações muito partilhadas entram numa fila de revisão. Casos com menores ou violência doméstica vindos de redes sociais só aparecem depois de revistos.",
  "Cada ocorrência tem data de publicação, data da ocorrência e uma área geográfica. Sem um destes dados, o registo é recusado.",
  "A localização nunca é uma morada: é a freguesia, a localidade ou uma área pública nomeada por uma fonte fiável. Com só a freguesia, o marcador fica no interior da freguesia e a área é assinalada. Em violência doméstica, só a freguesia.",
  "Os resumos são escritos a partir de modelos neutros: não reproduzem nomes, idades, moradas, matrículas ou outros pormenores, nem atribuem culpa. Se uma publicação de rede social expõe dados pessoais, a ligação não é publicada.",
];

export async function IncidentSection({ params }: { params: SearchParams }) {
  const now = new Date();
  const range = clampRange(now, params.de, params.ate);
  // Margem de um dia: o corte exato faz-se pelo dia civil de Lisboa.
  const since = windowStart(now);
  const firstDay = windowStartDay(now);
  const [rows, olderThanWindow, archivedRecent, held, lastRun] = await Promise.all([
    db.incident.findMany({ where: publicIncidentWhere(now), include: { references: true }, orderBy: [{ incidentStart: "desc" }, { publicationDate: "desc" }] }),
    db.incident.count({ where: { archivedAt: null, heldForReview: false, incidentStart: { lt: new Date(`${firstDay}T00:00:00Z`) } } }),
    db.incident.count({ where: { archivedAt: { not: null }, incidentStart: { gte: since } } }),
    db.incident.count({ where: { archivedAt: null, heldForReview: true, incidentStart: { gte: since } } }),
    db.dataUpdateLog.findFirst({ where: { sourceId: { in: INCIDENT_SOURCES }, status: { not: "ERRO" } }, orderBy: { retrievalDate: "desc" } }),
  ]);

  const incidents = rows.filter((row) => !visibilityProblem(row, now)).map(toPublicIncident);

  const area = FREGUESIAS.some((item) => item.slug === params.area) ? params.area! : "";
  const tipo = INCIDENT_CATEGORIES.includes(params.tipo as (typeof INCIDENT_CATEGORIES)[number]) ? params.tipo! : "";
  const estado = VERIFICATION_STATUSES.includes(params.estado as (typeof VERIFICATION_STATUSES)[number]) ? params.estado! : "";
  const fonte = params.fonte?.slice(0, 80) ?? "";

  return (
    <section aria-labelledby="ocorrencias" className="space-y-4">
      <div>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-record/40 bg-record-soft px-3 py-1 text-sm font-semibold text-record">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5 1.5v3M11 1.5v3" /></svg>
          Só os últimos {WINDOW_DAYS} dias: {formatLongDay(range.min)} a {formatLongDay(range.max)}
        </p>
        <h2 id="ocorrencias" className="mt-2 font-serif text-2xl font-semibold">Ocorrências recentes</h2>
        <p className="mt-1 max-w-3xl">{METHOD_INTRO}</p>
      </div>

      <IncidentExplorer
        incidents={incidents}
        freguesias={FREGUESIAS.map(({ slug, name }) => ({ slug, name }))}
        initial={{ area, tipo, estado, fonte, de: range.from, ate: range.to }}
        bounds={{ min: range.min, max: range.max }}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 text-xs text-muted">
          {lastRun ? <p>Fontes consultadas pela última vez a {formatDateTime(lastRun.retrievalDate)}.</p> : <p>As fontes de ocorrências ainda não foram consultadas.</p>}
          {olderThanWindow > 0 ? <p>{olderThanWindow === 1 ? "1 ocorrência com mais de 14 dias saiu do mapa e está no arquivo." : `${olderThanWindow} ocorrências com mais de 14 dias saíram do mapa e estão no arquivo.`}</p> : null}
          {archivedRecent > 0 ? <p>{archivedRecent === 1 ? "1 ocorrência recente foi arquivada por não se ter confirmado, ter sido apagada ou contrariada." : `${archivedRecent} ocorrências recentes foram arquivadas por não se terem confirmado, terem sido apagadas ou contrariadas.`}</p> : null}
          {held > 0 ? <p>{held === 1 ? "1 registo aguarda revisão e não é mostrado." : `${held} registos aguardam revisão e não são mostrados.`}</p> : null}
        </div>
        <CsvLink href="/dados/ocorrencias.csv" label="Descarregar CSV, com arquivo" />
      </div>

      <Disclosure summary="Como verificamos: estados, níveis das fontes, 14 dias e localização aproximada">
        <dl className="grid max-w-3xl gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          {VERIFICATION_STATUSES.map((status) => (
            <div key={status} className="contents">
              <dt className="font-semibold">{VERIFICATION_LABEL[status]}</dt>
              <dd>{VERIFICATION_HELP[status]}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-5 text-sm">
          {POLICY.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <p className="mt-2 text-sm">
          Níveis: {Object.values(SOURCE_TIER_LABEL).map((label, index) => `${index + 1}, ${label.toLowerCase()}`).join("; ")}.
        </p>
        <p className="mt-2 text-sm">
          Limites das freguesias: <ExternalLink href={BOUNDARIES_SOURCE.url}>{BOUNDARIES_SOURCE.label}</ExternalLink>. Mapa de fundo: OpenStreetMap. Origens e frequência de recolha em <ExternalLink href="/estado-das-fontes">Estado das fontes</ExternalLink>.
        </p>
      </Disclosure>
    </section>
  );
}
