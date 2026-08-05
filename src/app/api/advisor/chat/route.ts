import type { NextRequest } from "next/server";
import { apiError, apiOk, requireSession, runApi } from "@/lib/api";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";
import { DATE_RANGES, type DateRange } from "@/lib/validators";
import { answerQuestion } from "@/server/ai/advisor";
import { tryLlmAnswer } from "@/server/ai/llm";

export async function POST(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(t("api.invalidJson"), 400);
    }
    const { question, range } = (body as { question?: unknown; range?: unknown }) ?? {};
    if (typeof question !== "string" || question.trim().length === 0) {
      return apiError(t("api.questionRequired"), 400);
    }
    if (question.trim().length > 500) {
      return apiError(t("api.questionTooLong"), 400);
    }
    const safeRange: DateRange = DATE_RANGES.includes(range as DateRange) ? (range as DateRange) : "30d";
    const companyId = session.company.id;
    const currency = session.company.currency;

    const llmAnswer = await tryLlmAnswer(companyId, safeRange, currency, locale, question.trim());
    if (llmAnswer) return apiOk(llmAnswer);

    const answer = await answerQuestion(companyId, safeRange, currency, locale, question.trim());
    return apiOk(answer);
  }, locale);
}
