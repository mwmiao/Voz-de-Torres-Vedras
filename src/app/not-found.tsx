import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-serif text-3xl font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-muted">O endereço pode ter mudado.</p>
      <Link href="/" className="mt-4 inline-block underline">Voltar ao início</Link>
    </div>
  );
}
