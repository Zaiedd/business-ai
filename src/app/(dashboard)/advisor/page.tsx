"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, Eraser, Send, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  bullets?: string[];
  tone?: "info" | "success" | "warning" | "critical";
}

const SUGGESTION_KEYS = ["revenue", "profit", "expenses", "stock", "health", "top"] as const;

const toneColor: Record<string, string> = {
  info: "text-slate-500 dark:text-slate-400",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-rose-600 dark:text-rose-400",
};

export default function AdvisorPage() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? t("advisor.errors.generic"));
        setBusy(false);
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: body.data.answer, bullets: body.data.bullets ?? [], tone: body.data.tone },
      ]);
      setBusy(false);
    } catch {
      setError(t("advisor.errors.generic"));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("advisor.title")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("advisor.subtitle")}</p>
      </div>

      <Card className="flex min-h-[520px] flex-col">
        <CardHeader
          title={t("advisor.title")}
          subtitle={t("advisor.subtitle")}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              disabled={busy || messages.length === 0}
            >
              <Eraser className="size-3.5" />
              {t("advisor.clear")}
            </Button>
          }
        />
        <CardBody className="flex flex-1 flex-col gap-0 p-0">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {messages.length === 0 && !busy && (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
                  <Sparkles className="size-6 text-white" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{t("advisor.emptyTitle")}</h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{t("advisor.emptySubtitle")}</p>
                <div className="mt-6 flex max-w-md flex-wrap justify-center gap-2">
                  {SUGGESTION_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => ask(t(`advisor.suggestions.${k}`))}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950"
                    >
                      {t(`advisor.suggestions.${k}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    m.role === "user"
                      ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
                      : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white",
                  )}
                >
                  {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
                </div>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                    m.role === "user"
                      ? "rounded-tr-sm bg-indigo-600 text-white"
                      : "rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  {m.bullets && m.bullets.length > 0 && (
                    <ul className={cn("mt-2 space-y-1 text-xs", toneColor[m.tone ?? "info"])}>
                      {m.bullets.map((b, j) => (
                        <li key={j}>• {b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                  <Bot className="size-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <span className="flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-slate-400" />
                  </span>
                  {t("advisor.typing")}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2 border-t border-slate-200 p-4 dark:border-slate-700"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("advisor.placeholder")}
              className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <Button type="submit" loading={busy} disabled={!input.trim()}>
              <Send className="size-4" />
              {t("advisor.send")}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
