"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-3xl font-semibold">Não foi possível abrir esta página</h1>
      <p className="mt-2 text-muted">Ocorreu um erro ao ler os dados. Os documentos oficiais continuam disponíveis nos sites de origem.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={reset}>Tentar novamente</button>
        <Link href="/" className="btn-quiet no-underline">Voltar ao início</Link>
      </div>
    </div>
  );
}
