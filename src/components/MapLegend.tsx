import { STATUS_CLASS, STATUS_ICON } from "@/lib/incident-status";
import { VERIFICATION_HELP, VERIFICATION_LABEL, VERIFICATION_STATUSES, WINDOW_DAYS } from "@/lib/incidents";

/** Legenda visível: estados, localização aproximada e limite de 14 dias. */
export function MapLegend() {
  return (
    <section aria-labelledby="legenda-ocorrencias" className="rounded-lg border border-line bg-surface p-3">
      <h3 id="legenda-ocorrencias" className="text-sm font-semibold">Legenda</h3>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {VERIFICATION_STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-2">
            <span aria-hidden="true" className={`incident-marker incident-marker--legend ${STATUS_CLASS[status]}`}>
              <svg viewBox="0 0 16 16" className="status-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={STATUS_ICON[status]} /></svg>
            </span>
            <span className="font-semibold">{VERIFICATION_LABEL[status]}</span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block size-6 shrink-0 rounded-full border-2 border-dashed border-record bg-record/10" />
          <span className="font-semibold">Localização aproximada</span>
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded border-2 border-dashed border-record px-1 text-xs font-bold text-record">TV</span>
          <span className="font-semibold">Concelho inteiro</span>
        </li>
        <li className="flex items-center gap-2">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-6 shrink-0 text-record" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5 1.5v3M11 1.5v3" /></svg>
          <span className="font-semibold">Limite de {WINDOW_DAYS} dias</span>
        </li>
      </ul>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-record underline">O que significa cada estado</summary>
        <dl className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
          {VERIFICATION_STATUSES.map((status) => (
            <div key={status} className="contents">
              <dt className="font-semibold">{VERIFICATION_LABEL[status]}</dt>
              <dd className="text-muted">{VERIFICATION_HELP[status]}</dd>
            </div>
          ))}
          <dt className="font-semibold">Localização aproximada</dt>
          <dd className="text-muted">Círculo tracejado em volta da localidade, ou a freguesia tracejada quando só a freguesia é conhecida. Nunca uma morada.</dd>
          <dt className="font-semibold">Concelho inteiro</dt>
          <dd className="text-muted">Botão no canto do mapa com as ocorrências que a fonte só situa no concelho, sem freguesia. Não têm marcador, para não sugerir um lugar.</dd>
          <dt className="font-semibold">Limite de {WINDOW_DAYS} dias</dt>
          <dd className="text-muted">Só aparecem ocorrências das duas últimas semanas, até 14 dias antes de hoje, pela data da ocorrência. Sem data na fonte, conta a data da notícia.</dd>
        </dl>
      </details>
    </section>
  );
}
