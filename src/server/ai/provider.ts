import { generateInsights } from "@/server/ai/insights";
import type { Insight } from "@/server/ai/types";
import type { DateRange } from "@/lib/validators";

/**
 * Pluggable AI layer.
 *
 * The default provider is the built-in LOCAL ANALYTICS ENGINE — a deterministic
 * business-rules + statistics engine that runs entirely on-device for $0.
 *
 * To upgrade to an LLM-powered advisor later (OpenAI / Anthropic / local Ollama),
 * implement the AIProvider interface below and return it from `getProvider()`.
 * The rest of the platform is already decoupled from the provider.
 */
export interface AIProvider {
  name: string;
  cost: "free" | "metered";
  available: boolean;
  analyze(companyId: string, range: DateRange, currency: string): Promise<Insight[]>;
}

export const localAnalyticsEngine: AIProvider = {
  name: "Business AI Analytics Engine",
  cost: "free",
  available: true,
  analyze: generateInsights,
};

// Example of an LLM-backed provider (kept out of the default path so the
// product never requires paid API keys to run). Enable via env vars.
export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL);
}

export function getProvider(): AIProvider {
  if (isLLMConfigured()) {
    // TODO: wire an OpenAI-compatible client here when the user opts in.
    return localAnalyticsEngine;
  }
  return localAnalyticsEngine;
}
