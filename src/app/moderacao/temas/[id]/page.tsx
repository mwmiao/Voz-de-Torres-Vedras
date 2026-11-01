import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { saveIssue } from "../../actions";

const ERRORS: Record<string, string> = {
  fonte: "A fonte tem de ter título e um domínio oficial.",
  "sem-fonte": "Um tema só pode ser publicado com, pelo menos, uma fonte oficial.",
};

export default async function EditarTemaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const { erro } = await searchParams;
  const issue = await db.issue.findUnique({ where: { id }, include: { options: { orderBy: { order: "asc" } }, sources: true } });
  if (!issue) notFound();

  return (
    <form action={saveIssue} className="max-w-2xl space-y-4">
      <h2 className="font-serif text-xl font-semibold">Editar tema</h2>
      {erro && ERRORS[erro] ? <p role="alert" className="font-medium">{ERRORS[erro]}</p> : null}
      <input type="hidden" name="id" value={issue.id} />
      <label className="block font-medium">Título<input name="title" defaultValue={issue.title} className="field mt-1" required /></label>
      <label className="block font-medium">Resumo neutro<textarea name="summary" defaultValue={issue.summary} rows={5} className="field mt-1" required /></label>
      <label className="block font-medium">Fase<input name="stage" defaultValue={issue.stage} className="field mt-1" required /></label>
      <label className="block font-medium">Opções de posição, uma por linha
        <textarea name="options" defaultValue={issue.options.map((option) => option.label).join("\n")} rows={4} className="field mt-1" />
        <span className="text-sm font-normal text-muted">Ficam bloqueadas depois da primeira posição registada.</span>
      </label>
      <label className="block font-medium">Estado
        <select name="status" defaultValue={issue.status} className="field mt-1">
          <option value="RASCUNHO">Rascunho</option>
          <option value="ATIVO">Ativo</option>
          <option value="ENCERRADO">Encerrado</option>
          <option value="ARQUIVADO">Arquivado</option>
        </select>
      </label>
      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 font-medium">Adicionar fonte oficial</legend>
        <p className="text-sm text-muted">Fontes atuais: {issue.sources.length}</p>
        <label className="mt-2 block text-sm font-medium">URL<input name="sourceUrl" type="url" className="field mt-1" /></label>
        <label className="mt-2 block text-sm font-medium">Título do documento<input name="sourceTitle" className="field mt-1" /></label>
      </fieldset>
      <button type="submit" className="btn">Guardar</button>
    </form>
  );
}
