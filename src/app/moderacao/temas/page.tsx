import Link from "next/link";
import { db } from "@/lib/db";

export default async function TemasModeracaoPage() {
  const issues = await db.issue.findMany({
    include: { _count: { select: { positions: true, sources: true } } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return (
    <>
      <h2 className="font-serif text-xl font-semibold">Temas</h2>
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
        {issues.map((issue) => (
          <li key={issue.id} className="p-3 text-sm">
            <Link href={`/moderacao/temas/${issue.id}`} className="font-medium underline">{issue.title}</Link>
            <span className="block text-muted">{issue.status} · {issue._count.sources} fontes</span>
          </li>
        ))}
      </ul>
    </>
  );
}
