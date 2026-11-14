"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/alertas", label: "Alertas" },
  { href: "/reunioes", label: "Reuniões e decisões" },
  { href: "/dossies", label: "Dossiês" },
  { href: "/orcamento", label: "Orçamento" },
  { href: "/contratos", label: "Contratos" },
  { href: "/camara", label: "Eleitos" },
  { href: "/seguranca", label: "Segurança" },
  { href: "/metricas", label: "Métricas" },
  { href: "/fontes", label: "Fontes" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const current = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
        <Link href="/" className="py-1 font-serif text-xl font-semibold no-underline">Voz de Torres Vedras</Link>
        <div className="lg:hidden">
          <button ref={button} type="button" className="btn-quiet" aria-expanded={open} aria-controls="navegacao" onClick={() => setOpen(!open)}>
            {open ? "Fechar" : "Menu"}
          </button>
        </div>
        {/* Pesquisa em todo o site: decisões, reuniões, contratos, concursos e documentos. */}
        <form role="search" method="get" action="/resumos" className="order-3 flex w-full gap-2 lg:order-none lg:w-80">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Pesquisar em todo o site</span>
            <input type="search" name="q" className="field site-search" placeholder="Pesquisar no site" />
          </label>
          <button type="submit" className="btn-quiet site-search">Pesquisar</button>
        </form>
        <nav id="navegacao" aria-label="Principal" className={`${open ? "block" : "hidden"} order-4 w-full lg:block`}>
          <ul className="flex flex-col gap-0.5 py-2 lg:-mx-2 lg:flex-row lg:py-0">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current(link.href) ? "page" : undefined}
                  className="nav-link"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
