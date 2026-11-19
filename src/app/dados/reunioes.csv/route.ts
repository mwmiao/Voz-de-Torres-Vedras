import { csvResponse, toCsv } from "@/lib/csv";
import { BODY_LABEL } from "@/lib/format";
import { listMeetingsForExport } from "@/lib/queries/meetings";

export const dynamic = "force-dynamic";

export async function GET() {
  const meetings = await listMeetingsForExport();
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
