import { promises as fs } from "fs";
import type { NextRequest } from "next/server";
import { apiError, audit, requireSession, runApi } from "@/lib/api";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";
import { prisma } from "@/lib/db";
import { filePathFor } from "@/server/company-files";

export async function GET(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return apiError(t("api.missingId"), 400);

    const record = await prisma.companyFile.findFirst({ where: { id, companyId: session.company.id } });
    if (!record) return apiError(t("api.fileNotFound"), 404);

    let data: Buffer;
    try {
      data = await fs.readFile(filePathFor(session.company.id, record.storedName));
    } catch {
      return apiError(t("api.fileNotFound"), 404);
    }

    await audit(session, "FILE.DOWNLOADED", { entity: "company-file", entityId: record.id, metadata: { name: record.originalName }, req });

    const ascii = record.originalName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": record.mimeType || "application/octet-stream",
        "Content-Length": String(data.byteLength),
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(record.originalName)}`,
      },
    });
  }, locale);
}
