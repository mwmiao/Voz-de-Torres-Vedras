import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-muted md:grid-cols-[2fr_1fr]">
        <div>
          <p className="font-serif text-base font-semibold text-ink">Posições · Registos · Fontes</p>
          <p className="mt-1 max-w-prose">
            Projeto cívico independente. Não é um serviço do Município de Torres Vedras nem substitui os canais oficiais de participação.
          </p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-col gap-1">
          <Link href="/metodo" className="underline">Método e neutralidade</Link>
          <Link href="/privacidade" className="underline">Privacidade e dados pessoais</Link>
          <Link href="/visita-guiada" className="underline">Visita guiada</Link>
        </nav>
      </div>
    </footer>
  );
}
