import type { ContentKind, Outcome } from "@prisma/client";
import type { ReactNode } from "react";
import { formatDate, OUTCOME_LABEL } from "@/lib/format";

const KIND = {
  REGISTO_OFICIAL: { label: "Registo oficial", className: "bg-record-soft text-record" },
  CONTEXTO_EDITORIAL: { label: "Contexto editorial", className: "bg-editorial-soft text-editorial" },
} as const;

/** Separa o que é registo oficial do que é contexto escrito por esta plataforma. */
export function KindLabel({ kind }: { kind: ContentKind }) {
  const { label, className } = KIND[kind];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${className}`}>{label}</span>;
}

export function LastUpdated({ date, className = "" }: { date: Date | null | undefined; className?: string }) {
  if (!date) return null;
  return <p className={`text-xs text-muted ${className}`}>Última atualização: {formatDate(date)}</p>;
}

export function CsvLink({ href, label = "Descarregar CSV" }: { href: string; label?: string }) {
  return <a href={href} className="btn-quiet no-underline" download>{label}</a>;
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const pending = outcome === "POR_PUBLICAR";
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${pending ? "border-dashed border-muted text-muted" : "border-record/40 text-record"}`}>
      {OUTCOME_LABEL[outcome]}
    </span>
  );
}

export function PageHead({ kicker, title, children }: { kicker?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        {kicker ? <div className="mb-2">{kicker}</div> : null}
        <h1 className="font-serif text-3xl font-semibold md:text-4xl">{title}</h1>
        {children ? <div className="mt-3 max-w-3xl text-muted">{children}</div> : null}
      </div>
    </div>
  );
}
