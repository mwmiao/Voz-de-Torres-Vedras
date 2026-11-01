import type { Metadata } from "next";
import Link from "next/link";
import { requestLogin } from "@/app/actions";
import { PageHead } from "@/components/labels";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

const ERRORS: Record<string, string> = {
  email: "Indique um email válido.",
  consentimento: "Para participar, precisa de aceitar o tratamento dos dados.",
  descartavel: "Não aceitamos emails temporários: ajudam a garantir uma pessoa, uma posição.",
  limite: "Foram feitos demasiados pedidos. Tente novamente mais tarde.",
  ligacao: "Esta ligação já foi usada ou expirou. Peça uma nova.",
};

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ erro?: string; enviado?: string; seguinte?: string }> }) {
  const { erro, enviado, seguinte } = await searchParams;
  return (
    <>
      <PageHead title="Entrar"><p>Sem palavra-passe: enviamos uma ligação para o seu email.</p></PageHead>
      <div className="mx-auto max-w-md px-4 py-8">
        {enviado ? (
          <p role="status" className="rounded-lg border border-line bg-surface p-4 font-medium">Se o email for válido, vai receber uma ligação dentro de instantes. É válida durante 30 minutos.</p>
        ) : (
          <form action={requestLogin} className="space-y-4">
            {erro && ERRORS[erro] ? <p role="alert" className="font-medium">{ERRORS[erro]}</p> : null}
            <input type="hidden" name="seguinte" value={seguinte ?? "/conta"} />
            <label className="block font-medium">Email<input type="email" name="email" autoComplete="email" required className="field mt-1" /></label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="consentimento" required className="mt-1" />
              <span>Aceito que as minhas posições sejam tratadas para produzir resultados agregados, incluindo dados que possam revelar opiniões políticas. Li a <Link href="/privacidade" className="underline">informação sobre privacidade</Link>.</span>
            </label>
            <button type="submit" className="btn w-full">Enviar ligação</button>
          </form>
        )}
      </div>
    </>
  );
}
