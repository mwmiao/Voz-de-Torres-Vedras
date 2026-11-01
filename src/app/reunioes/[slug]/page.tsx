import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionList } from "@/components/DecisionTable";
import { KindLabel, LastUpdated, PageHead } from "@/components/labels";
import { SummaryBlock } from "@/components/civic";
import { Receipt } from "@/components/Receipts";
import { db } from "@/lib/db";
import { SOURCED_DECISION } from "@/lib/filters";
import { BODY_LABEL, formatDate, formatTime } from "@/lib/format";
import { summaryMap } from "@/lib/summary-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meeting = await db.meeting.findUnique({ where: { slug: (await params).slug }, select: { title: true } });
  return meeting ? { title: meeting.title } : {};
}

export default async function MeetingPage({ params }: Props) {
  const meeting = await db.meeting.findUnique({
    where: { slug: (await params).slug },
    include: {
      sources: { orderBy: { publishedAt: "desc" } },
      decisions: { where: SOURCED_DECISION, include: { meeting: true, sources: { where: { official: true } } } },
    },
  });
  if (!meeting) notFound();

  const [meetingSummary, summaries] = await Promise.all([
    summaryMap("reuniao", [meeting.slug]),
    summaryMap("decisao", meeting.decisions.map((decision) => decision.slug)),
  ]);
  const summary = meetingSummary.get(meeting.slug);
  const byItem = [...meeting.decisions].sort((a, b) => (a.itemNumber ?? "").localeCompare(b.itemNumber ?? "", "pt", { numeric: true }));

  return (
    <>
      <PageHead title={meeting.title} kicker={<div className="flex items-center gap-2"><Link href="/reunioes" className="text-sm underline">Reuniões e decisões</Link><KindLabel kind="REGISTO_OFICIAL" /></div>}>
        <p>
          {BODY_LABEL[meeting.body]} · {formatDate(meeting.date)}{meeting.hasTime ? `, ${formatTime(meeting.date)}` : ""}
          {meeting.location ? ` · ${meeting.location}` : ""}
        </p>
        <LastUpdated date={meeting.updatedAt} className="mt-1" />
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {summary ? <section aria-label="Resumo da reunião" className="max-w-3xl"><SummaryBlock summary={summary} heading={false} /></section> : null}
        {meeting.participation ? (
          <section>
            <h2 className="font-serif text-xl font-semibold">Intervenção do público</h2>
            <p className="mt-1 max-w-3xl">{meeting.participation}</p>
          </section>
        ) : null}
        <section>
          <h2 className="font-serif text-xl font-semibold">Agenda e decisões</h2>
          <div className="mt-3">
            {byItem.length > 0 ? <DecisionList decisions={byItem} summaries={summaries} /> : <p className="text-sm text-muted">Pontos ainda não transcritos. Consulte os documentos oficiais abaixo.</p>}
          </div>
        </section>
        <section>
          <h2 className="font-serif text-xl font-semibold">Documentos oficiais</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {meeting.sources.map((source) => <Receipt key={source.id} source={source} />)}
          </div>
        </section>
      </div>
    </>
  );
}
