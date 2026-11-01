import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getMinPublicCount, getProposalThreshold } from "@/lib/queries";
import { saveSettings, uploadImport } from "../actions";

const ERRORS: Record<string, string> = {
  ficheiro: "Escolha um ficheiro.",
  origem: "Indique o URL oficial de onde vieram os dados.",
  formato: "O ficheiro não está num formato válido.",
  definicoes: "Valores inválidos. O mínimo público não pode ser inferior a 5.",
};

export default async function ImportacaoPage({ searchParams }: { searchParams: Promise<{ erro?: string; concluida?: string }> }) {
  const { erro, concluida } = await searchParams;
  const [runs, threshold, minimum] = await Promise.all([
    db.importRun.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getProposalThreshold(),
    getMinPublicCount(),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="font-serif text-xl font-semibold">Importar dados</h2>
        {erro && ERRORS[erro] ? <p role="alert" className="mt-1 font-medium">{ERRORS[erro]}</p> : null}
        {concluida ? <p role="status" className="mt-1 font-medium text-record">Importação concluída. Veja o histórico.</p> : null}
        <form action={uploadImport} className="mt-3 space-y-3 rounded-lg border border-line bg-surface p-4">
          <label className="block font-medium">Conjunto
            <select name="kind" className="field mt-1">
              <option value="decisoes">Decisões (CSV ou JSON)</option>
              <option value="base">Contratos, formato IMPIC (JSON)</option>
            </select>
          </label>
          <label className="block font-medium">URL oficial de origem<input name="sourceUrl" type="url" className="field mt-1" /></label>
          <label className="block font-medium">Ficheiro<input name="file" type="file" accept=".csv,.json" className="mt-1 block" required /></label>
          <button type="submit" className="btn">Importar</button>
        </form>
        <p className="mt-2 text-sm text-muted">Até 5 MB. Ficheiros maiores: use <code>npm run import</code>. Linhas sem fonte oficial são recusadas e ficam listadas no histórico.</p>

        <h2 className="mt-8 font-serif text-xl font-semibold">Definições</h2>
        <form action={saveSettings} className="mt-3 space-y-3 rounded-lg border border-line bg-surface p-4">
          <label className="block font-medium">Apoios necessários para análise<input name="proposal_threshold" type="number" min={1} defaultValue={threshold} className="field mt-1" /></label>
          <label className="block font-medium">Mínimo de posições para publicar resultados<input name="min_public_count" type="number" min={5} defaultValue={minimum} className="field mt-1" /></label>
          <button type="submit" className="btn">Guardar</button>
        </form>
      </section>
      <section>
        <h2 className="font-serif text-xl font-semibold">Histórico</h2>
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {runs.map((run) => (
            <li key={run.id} className="p-3">
              <p className="font-medium">{run.dataset} · {run.fileName}</p>
              <p className="text-muted">{formatDate(run.createdAt)} · {run.imported} importados · {run.skipped} ignorados</p>
              <p className="truncate text-xs text-muted">Recolha {formatDate(run.retrievedAt)} · SHA-256 {run.sha256.slice(0, 16)}…</p>
              {Array.isArray(run.errors) && run.errors.length > 0 ? (
                <details className="mt-1"><summary className="cursor-pointer">Linhas recusadas</summary><pre className="mt-1 overflow-x-auto text-xs">{JSON.stringify(run.errors, null, 2)}</pre></details>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
