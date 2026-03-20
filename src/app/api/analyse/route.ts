import { analyseLogBuffer } from "@/lib/log-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const upload = formData.get("file");

    if (!(upload instanceof File)) {
      return Response.json({ error: "Bitte eine Log-Datei auswählen." }, { status: 400 });
    }

    if (!upload.size) {
      return Response.json({ error: "Die ausgewählte Datei ist leer." }, { status: 400 });
    }

    const report = analyseLogBuffer(await upload.arrayBuffer(), {
      fileName: upload.name,
      sizeBytes: upload.size,
    });

    return Response.json(report);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unbekannter Serverfehler bei der Analyse." },
      { status: 500 },
    );
  }
}
