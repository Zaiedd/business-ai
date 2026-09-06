import type { NextRequest } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db, cuid } from "@/lib/db";
import { companyFile, user as userTable } from "@/lib/drizzle/schema";
import { apiError, apiOk, audit, requireSession, runApi } from "@/lib/api";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";
import { isSupportedExt } from "@/server/file-analyzer";
import { analyzeFileData } from "@/server/file-analyzer";
import {
  MAX_FILE_BYTES,
  buildStoredName,
  fileToBase64,
  listCompanyFiles,
  safeOriginalName,
} from "@/server/company-files";

export async function GET(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  return runApi(async () => {
    const session = await requireSession(req);
    const files = await listCompanyFiles(session.company.id);
    return apiOk({ files });
  }, locale);
}

export async function POST(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return apiError(t("api.fileParseFailed"), 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) return apiError(t("api.fileRequired"), 400);
    if (file.size === 0) return apiError(t("api.emptyFile"), 400);
    if (file.size > MAX_FILE_BYTES) {
      return apiError(t("api.fileTooLarge", { max: String(MAX_FILE_BYTES / 1024 / 1024) }), 413);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const originalName = safeOriginalName(file.name);
    const ext = (originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".") + 1) : "").toLowerCase();
    const storedName = buildStoredName(originalName);

    let analysis: string | null = null;
    if (isSupportedExt(ext)) {
      const analyzed = await analyzeFileData(buf, ext, locale);
      analysis = analyzed ? [analyzed.narrative, ...analyzed.bullets].join("\n") : null;
    }

    const fileId = cuid();
    await db.insert(companyFile).values({
      id: fileId,
      companyId: session.company.id,
      uploadedById: session.user.id,
      originalName,
      storedName,
      mimeType: file.type || "application/octet-stream",
      ext,
      size: file.size,
      analysis,
      data: fileToBase64(buf),
    });

    const [record] = await db
      .select({
        id: companyFile.id,
        originalName: companyFile.originalName,
        mimeType: companyFile.mimeType,
        ext: companyFile.ext,
        size: companyFile.size,
        analysis: companyFile.analysis,
        createdAt: companyFile.createdAt,
        uploadedBy: { name: userTable.name },
      })
      .from(companyFile)
      .leftJoin(userTable, eq(companyFile.uploadedById, userTable.id))
      .where(eq(companyFile.id, fileId))
      .limit(1);

    await audit(session, "FILE.UPLOADED", { entity: "company-file", entityId: fileId, metadata: { name: originalName, size: file.size, ext }, req });
    return apiOk({ file: record }, { status: 201 });
  }, locale);
}

export async function DELETE(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return apiError(t("api.missingId"), 400);

    const [record] = await db.select().from(companyFile).where(and(eq(companyFile.id, id), eq(companyFile.companyId, session.company.id))).limit(1);
    if (!record) return apiError(t("api.fileNotFound"), 404);

    await db.delete(companyFile).where(eq(companyFile.id, record.id));
    await audit(session, "FILE.DELETED", { entity: "company-file", entityId: record.id, metadata: { name: record.originalName }, req });
    return apiOk({ ok: true });
  }, locale);
}
