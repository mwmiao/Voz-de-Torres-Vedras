import { pingDatabase } from "@/lib/queries/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pingDatabase();
    return Response.json({ estado: "ok" });
  } catch {
    return Response.json({ estado: "sem base de dados" }, { status: 503 });
  }
}
