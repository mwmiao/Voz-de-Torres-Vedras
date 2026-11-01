import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ estado: "ok" });
  } catch {
    return Response.json({ estado: "sem base de dados" }, { status: 503 });
  }
}
