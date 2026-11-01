import Link from "next/link";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/orcamento", label: "Orçamento" },
  { href: "/contratos", label: "Contratos" },
  { href: "/reunioes", label: "Reuniões e decisões" },
  { href: "/camara", label: "Câmara" },
  { href: "/fontes", label: "Fontes" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5">
        <Link href="/" className="font-serif text-xl font-semibold no-underline">
          Voz de Torres Vedras
        </Link>
        <nav aria-label="Principal" className="-mx-1 flex w-full gap-1 overflow-x-auto md:w-auto md:flex-1">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap rounded px-2 py-1.5 text-sm font-medium text-muted hover:bg-line/40 hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
