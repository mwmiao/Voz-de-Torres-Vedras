import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-muted md:grid-cols-[2fr_1fr]">
        <div>
          <p className="font-serif text-base font-semibold text-ink">Registos · Dados · Fontes</p>
          <p className="mt-1 max-w-prose">
            Projeto cívico independente, de acesso público e sem registo. Não é um serviço do Município de Torres Vedras. Em caso de divergência, prevalece sempre o documento oficial.
          </p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-col gap-1">
          <Link href="/resumos" className="underline">Resumos simples</Link>
          <Link href="/dossies" className="underline">Dossiês</Link>
          <Link href="/estado-das-fontes" className="underline">Estado das fontes</Link>
          <Link href="/metodo" className="underline">Método e neutralidade</Link>
          <Link href="/privacidade" className="underline">Privacidade</Link>
        </nav>
      </div>
    </footer>
  );
}
