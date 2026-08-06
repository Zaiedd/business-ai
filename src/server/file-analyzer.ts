import * as XLSX from "xlsx";
import type { Locale } from "@/lib/i18n";
import { serverT } from "@/lib/i18n/server";
import { tryLlmFileAnalysis } from "@/server/ai/llm";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_STATS_ROWS = 20_000;
export const PREVIEW_ROWS = 8;
export const SUPPORTED_EXTS = ["xlsx", "xls", "csv", "tsv", "txt", "json"] as const;

export type ColumnType = "number" | "date" | "boolean" | "text";

export interface ColumnStats {
  name: string;
  type: ColumnType;
  nonEmpty: number;
  missing: number;
  min?: number | string;
  max?: number | string;
  sum?: number;
  avg?: number;
  unique?: number;
}

export interface FileAnalysis {
  fileName: string;
  size: number;
  sheetName: string;
  rows: number;
  cols: number;
  columns: ColumnStats[];
  preview: string[][];
  narrative: string;
  bullets: string[];
  engine: "llm" | "rules";
}

type Cell = string | number | Date | boolean | null | undefined;

export function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function isSupportedExt(ext: string): boolean {
  return (SUPPORTED_EXTS as readonly string[]).includes(ext);
}

function cellText(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v);
}

function toNumber(v: Cell): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isDateLike(v: Cell): boolean {
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  if (typeof v !== "string" || v === "") return false;
  return /^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{2}\/\d{2}\/\d{4}/.test(v);
}

function toDate(v: Cell): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v !== "string" || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseRows(buf: Buffer, ext: string): { sheetName: string; rows: Cell[][] } {
  if (ext === "json") {
    const text = buf.toString("utf8");
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("JSON_ROOT_NOT_ARRAY");
    const headerKeys = new Set<string>();
    for (const obj of parsed) {
      if (obj && typeof obj === "object") for (const k of Object.keys(obj)) headerKeys.add(k);
    }
    const headers = [...headerKeys];
    const rows: Cell[][] = [headers];
    for (const obj of parsed) {
      if (!obj || typeof obj !== "object") continue;
      rows.push(headers.map((h) => ((obj as Record<string, unknown>)[h] ?? null) as Cell));
    }
    return { sheetName: "JSON", rows };
  }

  const raw = ext === "csv" || ext === "tsv" || ext === "txt" ? buf.toString("utf8") : buf;
  const book = XLSX.read(raw as Buffer, {
    type: ext === "csv" || ext === "tsv" || ext === "txt" ? "string" : "buffer",
    cellDates: true,
    raw: true,
  });
  const first = book.SheetNames[0] ?? "Sheet1";
  const ws = book.Sheets[first];
  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null });
  return { sheetName: first, rows };
}

export function analyzeRows(rows: Cell[][]): { columns: ColumnStats[]; preview: string[][]; rowsCount: number } {
  const dataRows = rows.slice(1);
  const limited = dataRows.slice(0, MAX_STATS_ROWS);
  const width = rows.reduce((m, r) => Math.max(m, r?.length ?? 0), 0);
  const header = (rows[0] ?? []).map((c, i) => cellText(c) || `Column ${i + 1}`);

  const columns: ColumnStats[] = [];
  for (let c = 0; c < width; c++) {
    const values = limited.map((r) => r?.[c] ?? null);
    const nonEmpty = values.filter((v) => cellText(v) !== "");
    const missing = values.length - nonEmpty.length;

    const numeric = nonEmpty.map(toNumber).filter((n): n is number => n !== null);
    const dateVals = nonEmpty.map(toDate).filter((d): d is Date => d !== null);
    const boolVals = nonEmpty.filter((v) => v === true || v === false || /^(true|false|yes|no|0|1)$/i.test(cellText(v)));

    let type: ColumnType = "text";
    if (nonEmpty.length > 0) {
      if (numeric.length === nonEmpty.length) type = "number";
      else if (dateVals.length === nonEmpty.length) type = "date";
      else if (boolVals.length === nonEmpty.length) type = "boolean";
    }

    const col: ColumnStats = { name: header[c], type, nonEmpty: nonEmpty.length, missing };
    if (type === "number" && numeric.length > 0) {
      const sorted = [...numeric].sort((a, b) => a - b);
      col.min = sorted[0];
      col.max = sorted[sorted.length - 1];
      col.sum = numeric.reduce((a, b) => a + b, 0);
      col.avg = col.sum / numeric.length;
    } else if (type === "date" && dateVals.length > 0) {
      const times = dateVals.map((d) => d.getTime());
      col.min = new Date(Math.min(...times)).toISOString().slice(0, 10);
      col.max = new Date(Math.max(...times)).toISOString().slice(0, 10);
    } else {
      col.unique = new Set(nonEmpty.map(cellText)).size;
    }
    columns.push(col);
  }

  const preview: string[][] = [header];
  for (const r of rows.slice(1, 1 + PREVIEW_ROWS)) {
    preview.push(header.map((_, i) => cellText(r?.[i])));
  }

  return { columns, preview, rowsCount: dataRows.length };
}

export function rulesNarrative(a: { rows: number; cols: number; sheetName: string; columns: ColumnStats[] }, locale: Locale): { narrative: string; bullets: string[] } {
  const t = serverT(locale);
  const bullets: string[] = [];
  const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString(locale) : n.toLocaleString(locale, { maximumFractionDigits: 2 }));

  let narrative = t("analyzer.narrative.intro", { cols: String(a.cols), rows: String(a.rows), sheet: a.sheetName });

  const numeric = a.columns.filter((c) => c.type === "number");
  const dates = a.columns.filter((c) => c.type === "date");
  const withMissing = a.columns.filter((c) => c.missing > 0);

  for (const c of numeric) {
    if (c.sum !== undefined && c.avg !== undefined) {
      bullets.push(t("analyzer.narrative.numericLine", { name: c.name, sum: fmt(c.sum), avg: fmt(c.avg), min: fmt(c.min as number), max: fmt(c.max as number) }));
    }
  }
  for (const c of dates) {
    bullets.push(t("analyzer.narrative.dateLine", { name: c.name, min: String(c.min), max: String(c.max) }));
  }
  for (const c of withMissing) {
    bullets.push(t("analyzer.narrative.missingLine", { name: c.name, missing: String(c.missing) }));
  }

  if (numeric.length > 0) {
    const biggest = [...numeric].sort((a, b) => (b.sum ?? 0) - (a.sum ?? 0))[0];
    if (biggest.sum !== undefined) {
      bullets.push(t("analyzer.narrative.topColumn", { name: biggest.name, sum: fmt(biggest.sum) }));
    }
  }
  if (bullets.length === 0) bullets.push(t("analyzer.narrative.noNumeric"));

  return { narrative, bullets };
}

export function buildFileDigest(a: { sheetName: string; rows: number; columns: ColumnStats[]; preview: string[][] }): string {
  const lines: string[] = [];
  lines.push(`File: sheet "${a.sheetName}", ${a.rows} data rows, ${a.columns.length} columns.`);
  for (const c of a.columns) {
    let s = `- ${c.name} [${c.type}]${c.missing ? ` missing=${c.missing}` : ""}`;
    if (c.type === "number") s += ` sum=${c.sum} avg=${c.avg?.toFixed(2)} min=${c.min} max=${c.max}`;
    else if (c.type === "date") s += ` range=${c.min}..${c.max}`;
    else if (c.unique !== undefined) s += ` unique=${c.unique}`;
    lines.push(s);
  }
  lines.push("Preview rows:");
  for (const r of a.preview.slice(0, 6)) lines.push("| " + r.join(" | "));
  return lines.join("\n");
}

export interface AnalyzedData {
  narrative: string;
  bullets: string[];
  engine: "llm" | "rules";
}

export async function analyzeFileData(buf: Buffer, ext: string, locale: Locale): Promise<AnalyzedData | null> {
  try {
    const { sheetName, rows } = parseRows(buf, ext);
    if (rows.length < 2) return null;
    const { columns, preview, rowsCount } = analyzeRows(rows);
    const summary = { rows: rowsCount, cols: columns.length, sheetName, columns };
    const rules = rulesNarrative(summary, locale);
    const digest = buildFileDigest({ sheetName, rows: rowsCount, columns, preview });
    const llm = await tryLlmFileAnalysis(locale, digest);
    return llm
      ? { narrative: llm, bullets: [], engine: "llm" }
      : { narrative: rules.narrative, bullets: rules.bullets, engine: "rules" };
  } catch {
    return null;
  }
}
