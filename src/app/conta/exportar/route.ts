import { exportMyData } from "@/app/actions";

export async function GET() {
  return new Response(await exportMyData(), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="os-meus-dados.json"',
      "Cache-Control": "no-store",
    },
  });
}
