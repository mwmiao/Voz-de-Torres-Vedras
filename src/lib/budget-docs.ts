export type DocGroup = { group: string; items: { id: string; url: string; label: string }[] };

/** Documentos agrupados pelo conjunto a que pertencem: «2025, Prestação de contas final: Balanço». */
export function groupBudgetDocs(docs: { id: string; url: string; title: string }[]): DocGroup[] {
  const groups = new Map<string, DocGroup["items"]>();
  for (const doc of docs) {
    const cut = doc.title.indexOf(": ");
    const group = cut > 0 ? doc.title.slice(0, cut) : "Outros documentos";
    groups.set(group, [...(groups.get(group) ?? []), { id: doc.id, url: doc.url, label: cut > 0 ? doc.title.slice(cut + 2) : doc.title }]);
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}
