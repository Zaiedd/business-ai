import type { NextRequest } from "next/server";
import { apiError, apiOk, requireSession, runApi } from "@/lib/api";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";
import {
  MAX_FILE_BYTES,
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
    await requireSession(req);

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
    const ext = fileExt(file.name);
    if (!isSupportedExt(ext)) return apiError(t("api.unsupportedFileType"), 400);

    let parsed;
    try {
      parsed = parseRows(Buffer.from(await file.arrayBuffer()), ext);
    } catch {
      return apiError(t("api.fileParseFailed"), 400);
    }
    if (parsed.rows.length < 2) return apiError(t("api.emptyFile"), 400);

    const { columns, preview, rowsCount } = analyzeRows(parsed.rows);
    const analyzed = await analyzeFileData(Buffer.from(await file.arrayBuffer()), ext, locale);

    return apiOk({
      fileName: file.name,
      size: file.size,
      sheetName: parsed.sheetName,
      rows: rowsCount,
      cols: columns.length,
      columns,
      preview,
      narrative: analyzed?.narrative ?? "",
      bullets: analyzed?.bullets ?? [],
      engine: analyzed?.engine ?? "rules",
    });
  }, locale);
}
