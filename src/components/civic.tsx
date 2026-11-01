import type { Alert, AlertSeverity, Summary } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ALERT_TYPE_LABEL, SEVERITY_LABEL } from "@/lib/alerts";
import { formatDate, formatDateTime } from "@/lib/format";
import { SUMMARY_TYPE_LABEL, SUMMARY_UNAVAILABLE } from "@/lib/summaries";
import type { Trend } from "@/lib/trends";

export function ExternalLink({ href, children, className = "underline" }: { href: string; children: ReactNode; className?: string }) {
  const internal = href.startsWith("/");
  if (internal) return <Link href={href} className={className}>{children}</Link>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (abre noutra janela)</span>
    </a>
  );
}

const SEVERITY_STYLE: Record<AlertSeverity, { className: string; path: string }> = {
  INFORMATIVO: { className: "severity-info", path: "M8 7v5M8 4.5v.5" },
  ATENCAO: { className: "severity-attention", path: "M8 5v4M8 11.5v.5" },
  IMPORTANTE: { className: "severity-important", path: "M8 4v5M8 11.5v.5M5 4v5M5 11.5v.5" },
  CRITICO: { className: "severity-critical", path: "M4.5 4.5l7 7M11.5 4.5l-7 7" },
};

/** A gravidade nunca depende só da cor: tem sempre ícone e texto. */
export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const { className, path } = SEVERITY_STYLE[severity];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={path} /></svg>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

function period(alert: Alert): string {
  const format = alert.hasTime ? formatDateTime : formatDate;
  const start = alert.startsAt ? format(alert.startsAt) : null;
  if (alert.hasOfficialEnd && alert.endsAt) return start && start !== format(alert.endsAt) ? `De ${start} a ${format(alert.endsAt)}` : `A ${format(alert.endsAt)}`;
  return start ? `Desde ${start}. A fonte não indica data de fim` : "A fonte não indica datas";
}

export function AlertCard({ alert, compact = false }: { alert: Alert; compact?: boolean }) {
  return (
    <article className={`rounded-lg border border-l-4 border-line bg-surface p-4 ${SEVERITY_STYLE[alert.severity].className}-edge`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} />
        <span className="text-xs font-semibold text-muted">{ALERT_TYPE_LABEL[alert.type]}</span>
      </div>
      <h3 className="mt-2 font-semibold leading-snug">{alert.title}</h3>
      {compact ? null : <p className="mt-1 text-sm">{alert.description}</p>}
      <dl className="mt-2 grid gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="font-medium text-muted">Quando</dt>
        <dd>{period(alert)}</dd>
        <dt className="font-medium text-muted">Onde</dt>
        <dd>{alert.geographicArea}</dd>
      </dl>
      <p className="mt-2 text-sm">
        <ExternalLink href={alert.sourceUrl}>Ver aviso oficial<span className="sr-only">: {alert.title}</span></ExternalLink>
      </p>
      <p className="mt-1 text-xs text-muted">Verificado a {formatDateTime(alert.lastCheckedAt)}</p>
    </article>
  );
}

const TREND_PATH: Record<Trend["direction"], string> = {
  up: "M8 13V3M3.5 7.5 8 3l4.5 4.5",
  down: "M8 3v10M3.5 8.5 8 13l4.5-4.5",
  flat: "M2.5 8h11",
  none: "M4 8h.01M8 8h.01M12 8h.01",
};

/** A direção é neutra: sem verde nem vermelho, e sempre escrita por extenso. */
export function TrendText({ trend }: { trend: Trend }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={TREND_PATH[trend.direction]} /></svg>
      {trend.text}
    </span>
  );
}

export function MetricCard({ label, value, trend, note, source, updated, href }: {
  label: string;
  value: string;
  trend?: Trend;
  note?: string;
  source?: { href: string; label: string };
  updated?: Date | null;
  href?: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-2xl font-semibold tabular-nums">{href ? <Link href={href} className="no-underline hover:underline">{value}</Link> : value}</dd>
      {trend ? <dd className="mt-1"><TrendText trend={trend} /></dd> : null}
      {note ? <dd className="mt-1 text-xs text-muted">{note}</dd> : null}
      {source ? <dd className="mt-2 text-xs">Fonte: <ExternalLink href={source.href}>{source.label}</ExternalLink></dd> : null}
      {updated ? <dd className="mt-0.5 text-xs text-muted">Última atualização: {formatDate(updated)}</dd> : null}
    </div>
  );
}

/** As seis partes de um resumo, com o contexto separado dos factos. */
export function SummaryBlock({ summary, heading = true }: { summary: Summary; heading?: boolean }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      {heading ? (
        <>
          <p className="text-xs font-semibold text-muted">{SUMMARY_TYPE_LABEL[summary.entityType] ?? "Registo"}</p>
          <h3 className="mt-1 font-semibold leading-snug">
            {summary.href ? <Link href={summary.href} className="underline">{summary.title}</Link> : summary.title}
          </h3>
        </>
      ) : null}
      {summary.available ? (
        <>
          <p className="mt-3 text-sm font-semibold">Resumo simples</p>
          <p className="text-sm">{summary.simple}</p>
          {summary.meaning ? (
            <>
              <p className="mt-3 text-sm font-semibold">O que significa</p>
              <p className="text-sm">{summary.meaning}</p>
              <p className="mt-0.5 text-xs text-muted">Contexto geral escrito por esta plataforma, não retirado do documento.</p>
            </>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm">{SUMMARY_UNAVAILABLE}</p>
      )}
      <dl className="mt-3 grid gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="font-medium text-muted">Quem decidiu</dt>
        <dd>{summary.decidedBy}</dd>
        <dt className="font-medium text-muted">Estado</dt>
        <dd>{summary.status}</dd>
        <dt className="font-medium text-muted">Data</dt>
        <dd>{summary.date ? formatDate(summary.date) : "Não indicada na fonte"}</dd>
        <dt className="font-medium text-muted">Fonte oficial</dt>
        <dd><ExternalLink href={summary.sourceUrl}>Abrir documento<span className="sr-only">: {summary.title}</span></ExternalLink></dd>
      </dl>
    </article>
  );
}

/** Secundário: fica fechado, mas acessível por teclado e leitor de ecrã. */
export function Disclosure({ summary, children, open = false }: { summary: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="disclosure">
      <summary>{summary}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-muted bg-surface p-4">
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
    </div>
  );
}

/** Tabela larga: a região recebe foco, para que também se possa deslocar com o teclado. */
export function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="relative overflow-x-auto rounded-lg border border-line bg-surface">
      {children}
    </div>
  );
}

export function Pagination({ page, pages, link }: { page: number; pages: number; link: (target: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Páginas" className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? <Link href={link(page - 1)} className="btn-quiet no-underline">Anterior</Link> : <span />}
      <span className="text-muted">Página {page} de {pages}</span>
      {page < pages ? <Link href={link(page + 1)} className="btn-quiet no-underline">Seguinte</Link> : <span />}
    </nav>
  );
}

export function SectionHead({ id, title, children, action }: { id: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2 id={id} className="font-serif text-2xl font-semibold">{title}</h2>
        {children ? <p className="mt-1 max-w-3xl text-sm text-muted">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}
