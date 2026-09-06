import { createHash, randomBytes } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { companyFile, user as userTable } from "@/lib/drizzle/schema";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface CompanyFileRecord {
  id: string;
  originalName: string;
  mimeType: string;
  ext: string;
  size: number;
  analysis: string | null;
  createdAt: Date;
  uploadedBy: { name: string } | null;
}

export function safeOriginalName(name: string): string {
  return name.replace(/[\r\n\u0000-\u001F\u007F]/g, "").trim().slice(0, 255);
}

export function buildStoredName(originalName: string): string {
  const ext = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".") + 1).toLowerCase() : "";
  const token = createHash("sha256").update(originalName + randomBytes(8).toString("hex")).digest("hex").slice(0, 24);
  return `${token}${ext ? `.${ext}` : ""}`;
}

export function fileToBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

export function base64ToFile(value: string): Buffer {
  return Buffer.from(value, "base64");
}

export function formatFileSize(bytes: number, locale = "en"): string {
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toLocaleString(locale, { maximumFractionDigits: n >= 100 || i === 0 ? 0 : 1 })} ${units[i]}`;
}

export async function listCompanyFiles(companyId: string): Promise<CompanyFileRecord[]> {
  const rows = await db
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
    .where(eq(companyFile.companyId, companyId))
    .orderBy(desc(companyFile.createdAt));
  return rows;
}