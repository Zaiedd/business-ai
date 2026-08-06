import type { Locale } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";
import type { DateRange } from "@/lib/validators";
import { prisma } from "@/lib/db";
import { formatFileSize } from "@/server/company-files";
import {
  computeHealthScore,
  getAtRiskCustomers,
  getCustomerStats,
  getExpenseByCategory,
  getPeriodTotals,
  getStockStatus,
  getTopBranches,
  getTopEmployees,
  getTopProducts,
  rangeToBounds,
} from "@/server/analytics";
import type { AdvisorAnswer } from "@/server/ai/advisor";

export const OLLAMA_BASE_URL = "http://localhost:11434/v1";

export function llmConfig() {
  const rawBase = process.env.OPENAI_BASE_URL || OLLAMA_BASE_URL;
  return {
    baseUrl: rawBase.replace(/\/+$/, ""),
    apiKey: process.env.OPENAI_API_KEY || "ollama",
    model: process.env.AI_MODEL || "llama3.1",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 8000),
    probeTimeoutMs: Number(process.env.AI_PROBE_TIMEOUT_MS ?? 2000),
  };
}

export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_BASE_URL || process.env.OPENAI_API_KEY || process.env.AI_MODEL || process.env.OLLAMA_HOST);
}

/**
 * Cheap reachability probe. Some networks (or firewalls) blackhole the local
 * Ollama port instead of refusing it, so a plain chat call would hang until the
 * full timeout. Probing /models with a short timeout makes the deterministic
 * fallback kick in fast when the LLM is offline.
 *
 * Any HTTP response (even 404/401) counts as "reachable" — some OpenAI-compatible
 * providers (e.g. Google Gemini) may not implement GET /models; the actual chat
 * call is what decides success.
 *
 * The result is cached for a short TTL so an offline LLM only costs one probe
 * every 30s instead of paying the timeout on every message.
 */
const PROBE_TTL_MS = 30_000;
let lastProbe: { ok: boolean; at: number } | null = null;

export async function isLlmReachable(): Promise<boolean> {
  if (!isLLMConfigured()) return false;
  if (lastProbe && Date.now() - lastProbe.at < PROBE_TTL_MS) return lastProbe.ok;

  const { baseUrl, apiKey, probeTimeoutMs } = llmConfig();
  try {
    await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(probeTimeoutMs),
    });
    lastProbe = { ok: true, at: Date.now() };
    return true;
  } catch {
    lastProbe = { ok: false, at: Date.now() };
    return false;
  }
}

async function buildSnapshot(companyId: string, range: DateRange, currency: string): Promise<string> {
  const { from, to, prevFrom, prevTo } = rangeToBounds(range);
  const [cur, prev, products, branches, employees, expenses, stock, atRisk, customerStats, companyFiles] = await Promise.all([
    getPeriodTotals(companyId, from, to),
    getPeriodTotals(companyId, prevFrom, prevTo),
    getTopProducts(companyId, from, to, 3),
    getTopBranches(companyId, from, to, 3),
    getTopEmployees(companyId, from, to, 3),
    getExpenseByCategory(companyId, from, to),
    getStockStatus(companyId),
    getAtRiskCustomers(companyId, 45, 3),
    getCustomerStats(companyId, from, to),
    prisma.companyFile.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { originalName: true, ext: true, size: true, analysis: true, createdAt: true },
    }),
  ]);

  const fmt = (v: number) => formatCurrency(v, currency);
  const growth = prev.revenue !== 0 ? ((cur.revenue - prev.revenue) / Math.abs(prev.revenue)) * 100 : 0;
  const margin = cur.revenue > 0 ? (cur.netProfit / cur.revenue) * 100 : 0;
  const aov = cur.orders > 0 ? cur.revenue / cur.orders : 0;
  const health = computeHealthScore(cur, prev, customerStats);

  return [
    `Period revenue: ${fmt(cur.revenue)} (${growth > 0 ? "+" : ""}${growth.toFixed(1)}% vs previous period)`,
    `Net profit: ${fmt(cur.netProfit)} (margin ${margin.toFixed(1)}%)`,
    `Orders: ${cur.orders}, average order value: ${fmt(aov)}`,
    `Expenses: ${fmt(cur.expenses)}`,
    `Business health score: ${health.score}/100 (${health.label})`,
    products.length
      ? `Top products: ${products.map((p) => `${p.name} (${fmt(p.revenue)})`).join(", ")}`
      : "Top products: none",
    branches.length
      ? `Top branches: ${branches.map((b) => `${b.name} (${fmt(b.revenue)})`).join(", ")}`
      : "Top branches: none",
    employees.length
      ? `Top employees: ${employees.map((e) => `${e.name} (${e.orders} orders)`).join(", ")}`
      : "Top employees: none",
    expenses.length
      ? `Top expense categories: ${expenses.map((e) => `${e.category} (${fmt(e.amount)})`).join(", ")}`
      : "Top expense categories: none",
    stock.low.length ? `Low stock items: ${stock.low.map((p) => p.name).join(", ")}` : "Low stock items: none",
    `Active customers: ${customerStats.activeCustomers}, repeat rate: ${customerStats.repeatRate.toFixed(0)}%, at-risk: ${atRisk.length}`,
    companyFiles.length
      ? `Uploaded files (${companyFiles.length} most recent): ${companyFiles
          .map((f) => `${f.originalName} (${formatFileSize(f.size)})${f.analysis ? ` — analysis: ${f.analysis.split("\n").join(" ").slice(0, 300)}` : " — no analysis"}`)
          .join(" | ")}`
      : "Uploaded files: none",
  ].join("\n");
}

function systemPrompt(locale: Locale): string {
  const lang = locale === "ar" ? "Arabic" : "English";
  return [
    "You are the AI business advisor inside a business intelligence SaaS platform.",
    `Always respond in ${lang}.`,
    "Answer ONLY using the business snapshot provided. Do not invent numbers.",
    "Be concise: 2-4 sentences, no markdown headers, no bullets unless asked.",
    "If the question is off-topic (not about this business data), say you can only help with their business data.",
  ].join(" ");
}

async function chatCompletion(system: string, user: string, locale: Locale, opts?: { maxTokens?: number; timeoutMs?: number }): Promise<string | null> {
  if (!(await isLlmReachable())) return null;
  const { baseUrl, apiKey, model, timeoutMs } = llmConfig();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: opts?.maxTokens ?? 1000,
      }),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? timeoutMs),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Ask a local LLM (Ollama or any OpenAI-compatible endpoint) for an advisor
 * answer. Returns null when the endpoint is unreachable, the model is missing,
 * or anything else fails — callers should fall back to the deterministic
 * analytics engine so the feature never breaks when the LLM is offline.
 */
export async function tryLlmAnswer(
  companyId: string,
  range: DateRange,
  currency: string,
  locale: Locale,
  question: string,
): Promise<AdvisorAnswer | null> {
  const snapshot = await buildSnapshot(companyId, range, currency);
  const content = await chatCompletion(
    systemPrompt(locale),
    `Business snapshot:\n${snapshot}\n\nUser question: ${question}`,
    locale,
  );
  if (!content) return null;
  return { answer: content, bullets: [], tone: "info" };
}

function fileSystemPrompt(locale: Locale): string {
  const lang = locale === "ar" ? "Arabic" : "English";
  return [
    "You are a data analyst. You receive a compact digest of an uploaded spreadsheet (columns, types, statistics and a preview of the rows).",
    `Always respond in ${lang}.`,
    "Describe what this data looks like, the most notable patterns or problems (empty cells, anomalies, totals, date ranges), and 2-4 practical suggestions.",
    "Be concise: 4-8 sentences. Do NOT invent numbers that are not in the digest.",
  ].join(" ");
}

/**
 * Narrative analysis of an uploaded file. Returns null when the LLM is not
 * reachable — callers should fall back to the deterministic narrative.
 */
export async function tryLlmFileAnalysis(locale: Locale, digest: string): Promise<string | null> {
  return chatCompletion(
    fileSystemPrompt(locale),
    `Spreadsheet digest:\n${digest}`,
    locale,
    { maxTokens: 2048, timeoutMs: 25000 },
  );
}
