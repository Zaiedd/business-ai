import type { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { companyFile } from "@/lib/drizzle/schema";
import { apiError, audit, requireSession, runApi } from "@/lib/api";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";
import { base64ToFile } from "@/server/company-files";

export async function GET(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return apiError(t("api.missingId"), 400);

    const [record] = await db.select().from(companyFile).where(and(eq(companyFile.id, id), eq(companyFile.companyId, session.company.id))).limit(1);
    if (!record) return apiError(t("api.fileNotFound"), 404);
    if (!record.data) return apiError(t("api.fileNotFound"), 404);

    const data = base64ToFile(record.data);

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