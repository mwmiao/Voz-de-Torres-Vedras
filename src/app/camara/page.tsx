import type { Metadata } from "next";
import Link from "next/link";
import { KindLabel, LastUpdated, PageHead } from "@/components/labels";
import { SourceChips } from "@/components/Receipts";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Câmara", description: "Diretório neutro de eleitos municipais de Torres Vedras, com cargos, pelouros e comissões." };

export default async function CamaraPage() {
  const [officials, committees] = await Promise.all([
    db.official.findMany({ where: { active: true }, include: { sources: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    db.committee.findMany({
      include: { sources: true, members: { include: { official: true }, orderBy: [{ isChair: "desc" }, { official: { name: "asc" } }] } },
      orderBy: { name: "asc" },
    }),
  ]);
  const executive = officials.filter((official) => official.body === "EXECUTIVO_MUNICIPAL");
  const assembly = officials.filter((official) => official.body === "ASSEMBLEIA_MUNICIPAL");
  const groups = [
    { title: "Mesa da Assembleia", people: assembly.filter((person) => person.order < 10) },
    { title: "Deputados municipais", people: assembly.filter((person) => person.order === 10) },
    { title: "Presidentes de Junta de Freguesia", people: assembly.filter((person) => person.order === 50) },
  ];

  return (
    <>
      <PageHead title="Câmara" kicker={<KindLabel kind="REGISTO_OFICIAL" />}>
        <p>Diretório neutro, apenas com informação pública e oficial. Não inclui classificações, comentários nem apreciações sobre pessoas.</p>
        <LastUpdated date={officials[0]?.updatedAt} className="mt-1" />
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <section aria-labelledby="executivo">
          <h2 id="executivo" className="font-serif text-2xl font-semibold">Executivo Municipal</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {executive.map((official) => (
              <li key={official.id} className="rounded-lg border border-line bg-surface p-4">
                <h3 className="font-medium"><Link href={`/camara/${official.slug}`} className="underline">{official.name}</Link></h3>
                <p className="text-sm text-muted">{official.role} · {official.party}</p>
                <p className="mt-2 text-sm">
                  {official.portfolios.length > 0 ? `${official.portfolios.length} pelouros` : "Sem pelouros indicados na fonte"}
                </p>
                <div className="mt-2"><SourceChips sources={official.sources} /></div>
                <LastUpdated date={official.updatedAt} className="mt-2" />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="assembleia">
          <h2 id="assembleia" className="font-serif text-2xl font-semibold">Assembleia Municipal</h2>
          {groups.map((group) => (
            <div key={group.title} className="mt-4">
              <h3 className="font-semibold">{group.title}</h3>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {group.people.map((person) => (
                  <li key={person.id}>
                    <Link href={`/camara/${person.slug}`} className="underline">{person.name}</Link>
                    <span className="block text-xs text-muted">
                      {[person.order < 10 ? person.role : person.parish, person.party].filter(Boolean).join(" · ") || "Partido não indicado na fonte consultada"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section aria-labelledby="comissoes">
          <h2 id="comissoes" className="font-serif text-2xl font-semibold">Comissões da Assembleia Municipal</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {committees.map((committee) => (
              <article key={committee.id} className="rounded-lg border border-line bg-surface p-4">
                <h3 className="font-medium">{committee.name}</h3>
                <ul className="mt-2 text-sm text-muted">
                  {committee.members.map(({ official, isChair }) => (
                    <li key={official.id}>{official.name}{isChair ? " (presidência)" : ""}</li>
                  ))}
                </ul>
                <div className="mt-2"><SourceChips sources={committee.sources} /></div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
