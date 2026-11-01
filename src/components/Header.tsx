"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/orcamento", label: "Orçamento" },
  { href: "/contratos", label: "Contratos" },
  { href: "/reunioes", label: "Reuniões e decisões" },
  { href: "/camara", label: "Câmara" },
  { href: "/seguranca", label: "Segurança" },
  { href: "/alertas", label: "Alertas" },
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 px-4 py-2">
        <Link href="/" className="py-1 font-serif text-xl font-semibold no-underline">Voz de Torres Vedras</Link>
        <div className="lg:hidden">
          <button ref={button} type="button" className="btn-quiet" aria-expanded={open} aria-controls="navegacao" onClick={() => setOpen(!open)}>
            {open ? "Fechar" : "Menu"}
          </button>
        </div>
        <nav id="navegacao" aria-label="Principal" className={`${open ? "block" : "hidden"} w-full lg:block lg:w-auto`}>
          <ul className="flex flex-col gap-0.5 py-2 lg:flex-row lg:py-0">
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
