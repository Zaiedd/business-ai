import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, and, desc, asc, sql, count, inArray, lte, gte } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import * as schema from "./drizzle/schema";

// ── Database client ────────────────────────────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured. Set it in Cloudflare Workers → dashboard → Settings → Variables.");
}
const neonSql = neon(databaseUrl);
export const db = drizzle(neonSql, { schema });
export { eq, and, desc, asc, sql, count, inArray, lte, gte };

// ── ID generator (cuid-compatible) ─────────────────────────────────────────────
export function cuid(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(12).toString("base64url").slice(0, 24);
  return `c${timestamp}${random}`;
}

// ── Transaction helper (neon-http has no interactive tx; neonSql.transaction works over HTTP) ─
export type PreparedStmt = { sql: string; params: unknown[] };

export async function dbRunInTransaction(statements: PreparedStmt[]): Promise<void> {
  const q = neonSql as unknown as {
    transaction?: (qs: unknown[]) => Promise<unknown>;
    query: (text: string, params?: unknown[]) => unknown;
  };
  if (typeof q.transaction !== "function") {
    throw new Error("Transactions are not supported by the current neon driver");
  }
  await q.transaction(statements.map((s) => q.query(s.sql, s.params)));
}

// ── Raw SQL helper (for analytics $queryRaw patterns) ──────────────────────────
export async function rawQuery<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  const query = strings.reduce((result, str, i) => {
    const val = i < values.length ? values[i] : "";
    return result + str + (val !== undefined && val !== null ? String(val) : "");
  }, "");
  // Use Neon's tagged template for parameterized queries
  const result = await neonSql(strings, ...values);
  return result as T[];
}

// Re-export Drizzle's sql for use in analytics
export { sql as psql };
