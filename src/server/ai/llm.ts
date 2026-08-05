import type { Locale } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";
import type { DateRange } from "@/lib/validators";
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
  return {
    baseUrl: process.env.OPENAI_BASE_URL || OLLAMA_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY || "ollama",
    model: process.env.AI_MODEL || "llama3.1",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 8000),
  };
}

export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_BASE_URL || process.env.OPENAI_API_KEY || process.env.AI_MODEL || process.env.OLLAMA_HOST);
}

async function buildSnapshot(companyId: string, range: DateRange, currency: string): Promise<string> {
  const { from, to, prevFrom, prevTo } = rangeToBounds(range);
  const [cur, prev, products, branches, employees, expenses, stock, atRisk, customerStats] = await Promise.all([
    getPeriodTotals(companyId, from, to),
    getPeriodTotals(companyId, prevFrom, prevTo),
    getTopProducts(companyId, from, to, 3),
    getTopBranches(companyId, from, to, 3),
    getTopEmployees(companyId, from, to, 3),
    getExpenseByCategory(companyId, from, to),
    getStockStatus(companyId),
    getAtRiskCustomers(companyId, 45, 3),
    getCustomerStats(companyId, from, to),
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
  if (!isLLMConfigured()) return null;

  const { baseUrl, apiKey, model, timeoutMs } = llmConfig();
  const snapshot = await buildSnapshot(companyId, range, currency);

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
          { role: "system", content: systemPrompt(locale) },
          {
            role: "user",
            content: `Business snapshot:\n${snapshot}\n\nUser question: ${question}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    return { answer: content, bullets: [], tone: "info" };
  } catch {
    return null;
  }
}
