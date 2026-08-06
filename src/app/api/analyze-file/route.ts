import type { NextRequest } from "next/server";
import { apiError, apiOk, audit, requireSession, runApi } from "@/lib/api";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";
import { prisma } from "@/lib/db";
import {
  MAX_FILE_BYTES,
  buildStoredName,
  safeOriginalName,
  storeUploadedFile,
} from "@/server/company-files";
import {
  analyzeFileData,
  analyzeRows,
  fileExt,
  isSupportedExt,
  parseRows,
} from "@/server/file-analyzer";

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
    const ext = fileExt(file.name);
    const originalName = safeOriginalName(file.name);

    let analyzed = null;
    let parsed = null;
    if (isSupportedExt(ext)) {
      try {
        parsed = parseRows(buf, ext);
        if (parsed.rows.length >= 2) {
          analyzed = await analyzeFileData(buf, ext, locale);
        }
      } catch {
        parsed = null;
      }
    }

    const storedName = buildStoredName(originalName);
    await storeUploadedFile(session.company.id, storedName, buf);

    const analysis = analyzed ? [analyzed.narrative, ...analyzed.bullets].join("\n") : null;
    const record = await prisma.companyFile.create({
      data: {
        companyId: session.company.id,
        uploadedById: session.user.id,
        originalName,
        storedName,
        mimeType: file.type || "application/octet-stream",
        ext,
        size: file.size,
        analysis,
      },
      select: { id: true },
    });

    await audit(session, "FILE.UPLOADED", { entity: "company-file", entityId: record.id, metadata: { name: originalName, size: file.size, ext }, req });

    const stats = parsed && parsed.rows.length >= 2 ? analyzeRows(parsed.rows) : null;

    return apiOk({
      fileName: originalName,
      size: file.size,
      sheetName: parsed?.sheetName ?? null,
      rows: stats?.rowsCount ?? 0,
      cols: stats?.columns.length ?? 0,
      columns: stats?.columns ?? [],
      preview: stats?.preview ?? [],
      narrative: analyzed?.narrative ?? "",
      bullets: analyzed?.bullets ?? [],
      engine: analyzed?.engine ?? "none",
      saved: true,
      savedFileId: record.id,
      analyzable: Boolean(analyzed),
    });
  }, locale);
}
