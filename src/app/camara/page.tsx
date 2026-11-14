import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, FilterPanel } from "@/components/civic";
import { KindLabel, LastUpdated, PageHead, pageSections } from "@/components/labels";
import { SourceChips } from "@/components/Receipts";
import { db } from "@/lib/db";
import type { SearchParams } from "@/lib/filters";
import { searchKey } from "@/lib/search";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Eleitos", description: "Diretório neutro de eleitos municipais de Torres Vedras, com cargos, pelouros e comissões." };

export default async function CamaraPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = searchKey(params.q).trim();
  const [allOfficials, allCommittees] = await Promise.all([
    db.official.findMany({ where: { active: true }, include: { sources: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    db.committee.findMany({
      include: { sources: true, members: { include: { official: true }, orderBy: [{ isChair: "desc" }, { official: { name: "asc" } }] } },
      orderBy: { name: "asc" },
    }),
  ]);
  const matches = (...parts: (string | null | undefined)[]) => !q || searchKey(...parts).includes(q);
  const officials = allOfficials.filter((person) => matches(person.name, person.role, person.party, person.parish, ...(person.portfolios as string[])));
  const committees = allCommittees.filter((committee) => matches(committee.name, ...committee.members.map((member) => member.official.name)));
  const executive = officials.filter((official) => official.body === "EXECUTIVO_MUNICIPAL");
  const assembly = officials.filter((official) => official.body === "ASSEMBLEIA_MUNICIPAL");
  const groups = [
    { title: "Mesa da Assembleia", people: assembly.filter((person) => person.order < 10) },
    { title: "Deputados municipais", people: assembly.filter((person) => person.order === 10) },
    { title: "Presidentes de Junta de Freguesia", people: assembly.filter((person) => person.order === 50) },
  ].filter((group) => group.people.length > 0);
  const found = officials.length + committees.length;

  const { nav, id: anchor } = pageSections({ executivo: `Executivo Municipal (${executive.length})`, assembleia: `Assembleia Municipal (${assembly.length})`, comissoes: `Comissões (${committees.length})` });

  return (
    <>
      <PageHead
        title="Eleitos"
        kicker={<KindLabel kind="REGISTO_OFICIAL" />}
        sections={nav}
      >
        <p>Quem compõe a Câmara e a Assembleia Municipal. Diretório neutro, apenas com informação pública e oficial: não inclui classificações, comentários nem apreciações sobre pessoas.</p>
        <LastUpdated date={allOfficials[0]?.updatedAt} className="mt-1" />
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <FilterPanel clearHref={q ? "/camara" : undefined}>
          <form role="search" method="get" className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 text-sm font-medium">Procurar por nome, partido, pelouro ou freguesia
              <input type="search" name="q" defaultValue={params.q ?? ""} className="field mt-1" />
            </label>
            <button type="submit" className="btn">Procurar</button>
          </form>
        </FilterPanel>
        {q && found === 0 ? <EmptyState title="Nenhum eleito ou comissão corresponde à pesquisa."><Link href="/camara" className="underline">Limpar pesquisa</Link></EmptyState> : null}

        {executive.length > 0 ? (
        <section aria-labelledby={anchor.executivo}>
          <h2 id={anchor.executivo} className="font-serif text-2xl font-semibold">Executivo Municipal</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {executive.map((official) => (
              <li key={official.id} className="rounded-lg border border-line bg-surface p-4">
                <h3 className="font-medium"><Link href={`/camara/${official.slug}`} className="underline">{official.name}</Link></h3>
                <p className="text-sm text-muted">{official.role} · {official.party}</p>
                {(official.portfolios as string[]).length > 0 ? (
                  <p className="mt-2 text-sm"><span className="font-medium">Pelouros:</span> {(official.portfolios as string[]).join(" · ")}</p>
                ) : <p className="mt-2 text-sm text-muted">Sem pelouros indicados na fonte</p>}
                <div className="mt-2"><SourceChips sources={official.sources} /></div>
              </li>
            ))}
          </ul>
        </section>
        ) : null}

        {groups.length > 0 ? (
        <section aria-labelledby={anchor.assembleia}>
          <h2 id={anchor.assembleia} className="font-serif text-2xl font-semibold">Assembleia Municipal</h2>
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
        ) : null}

        {committees.length > 0 ? (
        <section aria-labelledby={anchor.comissoes}>
          <h2 id={anchor.comissoes} className="font-serif text-2xl font-semibold">Comissões da Assembleia Municipal</h2>
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
        ) : null}
      </div>
    </>
  );
}
