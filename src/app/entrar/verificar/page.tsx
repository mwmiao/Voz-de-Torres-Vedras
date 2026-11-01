import type { Metadata } from "next";
import { confirmLogin } from "@/app/actions";
import { PageHead } from "@/components/labels";

export const metadata: Metadata = { title: "Confirmar entrada", robots: { index: false } };

/** A entrada exige um clique: os filtros de email abrem ligações e gastariam o token num GET. */
export default async function VerificarPage({ searchParams }: { searchParams: Promise<{ token?: string; seguinte?: string }> }) {
  const { token, seguinte } = await searchParams;
  return (
    <>
      <PageHead title="Confirmar entrada" />
      <form action={confirmLogin} className="mx-auto max-w-md px-4 py-8">
        <input type="hidden" name="token" value={token ?? ""} />
        <input type="hidden" name="seguinte" value={seguinte ?? "/conta"} />
        <button type="submit" className="btn w-full">Entrar na minha conta</button>
      </form>
    </>
  );
}
