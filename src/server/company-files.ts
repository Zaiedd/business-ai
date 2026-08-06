import { createHash, randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";

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

export function uploadRoot(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

export function companyDir(companyId: string): string {
  return path.join(uploadRoot(), companyId);
}

export function safeOriginalName(name: string): string {
  return name.replace(/[\r\n\u0000-\u001F\u007F]/g, "").trim().slice(0, 255);
}

export function buildStoredName(originalName: string): string {
  const ext = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".") + 1).toLowerCase() : "";
  const token = createHash("sha256").update(originalName + randomBytes(8).toString("hex")).digest("hex").slice(0, 24);
  return `${token}${ext ? `.${ext}` : ""}`;
}

export function filePathFor(companyId: string, storedName: string): string {
  return path.join(companyDir(companyId), path.basename(storedName));
}

export async function storeUploadedFile(companyId: string, storedName: string, data: Buffer): Promise<void> {
  const dir = companyDir(companyId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, path.basename(storedName)), data);
}

export async function deleteStoredFile(companyId: string, storedName: string): Promise<void> {
  const p = filePathFor(companyId, storedName);
  try {
    await fs.unlink(p);
  } catch {
    // file already gone — ignore
  }
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
  const rows = await prisma.companyFile.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      ext: true,
      size: true,
      analysis: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  });
  return rows;
}
