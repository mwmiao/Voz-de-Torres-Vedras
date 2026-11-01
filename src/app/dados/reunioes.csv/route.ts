import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { BODY_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET() {
  const meetings = await db.meeting.findMany({ include: { sources: true }, orderBy: { date: "desc" } });
  const rows = meetings.map((meeting) => [
    meeting.date,
    BODY_LABEL[meeting.body],
    meeting.title,
    meeting.location,
    meeting.sources.map((source) => source.url).join(" "),
    meeting.updatedAt,
  ]);
  return csvResponse("reunioes-torres-vedras.csv", toCsv(["Data", "Órgão", "Reunião", "Local", "Fontes oficiais", "Última atualização"], rows));
}
