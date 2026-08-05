"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, ArrowRight, FileSearch, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";

interface ColumnStats {
  name: string;
  type: "number" | "date" | "boolean" | "text";
  nonEmpty: number;
  missing: number;
  min?: number | string;
  max?: number | string;
  sum?: number;
  avg?: number;
  unique?: number;
}

interface AnalysisResult {
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

const TYPE_KEYS = { number: "analyzer.typeNumber", date: "analyzer.typeDate", boolean: "analyzer.typeBoolean", text: "analyzer.typeText" } as const;

function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AnalyzerPage() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const analyze = useCallback(
    async (file: File) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      setResult(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/analyze-file", { method: "POST", body: fd });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? t("api.unexpected"));
          return;
        }
        setResult(body.data);
      } catch {
        setError(t("api.unexpected"));
      } finally {
        setBusy(false);
      }
    },
    [busy, t],
  );

  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) void analyze(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    onFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("analyzer.title")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("analyzer.subtitle")}</p>
      </div>

      {!result && !busy && (
        <Card>
          <CardBody className="p-0">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors",
                dragging
                  ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40"
                  : "border-slate-300 dark:border-slate-700",
              )}
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                <UploadCloud className="size-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("analyzer.dropTitle")}</p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  {t("analyzer.browse")}
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("analyzer.acceptedTypes")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("analyzer.sizeHint", { rows: "20000" })}</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt,.json"
                className="hidden"
                onChange={(e) => {
                  onFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {busy && (
        <Card>
          <CardBody className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Loader2 className="size-8 animate-spin text-indigo-600 dark:text-indigo-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t("analyzer.analyzing")}</p>
          </CardBody>
        </Card>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <>
          <Card>
            <CardHeader
              title={result.fileName}
              subtitle={t("analyzer.ready")}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setResult(null);
                    inputRef.current?.click();
                  }}
                >
                  <FileSearch className="size-3.5" />
                  {t("analyzer.newFile")}
                </Button>
              }
            />
            <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("analyzer.sheet")}</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{result.sheetName}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("analyzer.rows")}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatNumber(result.rows)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("analyzer.cols")}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatNumber(result.cols)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("analyzer.analysisTitle")}</p>
                <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {result.engine === "llm" ? t("analyzer.engineLlm") : t("analyzer.engineRules")}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("analyzer.analysisTitle")} />
            <CardBody>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                <Sparkles className="size-3.5" />
                {result.engine === "llm" ? t("analyzer.engineLlm") : t("analyzer.engineRules")}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{result.narrative}</p>
              {result.bullets.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                  {result.bullets.map((b, i) => (
                    <li key={i}>• {b}</li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("analyzer.columnTitle")} />
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="px-4 py-2.5 font-semibold">{t("analyzer.colName")}</th>
                      <th className="px-4 py-2.5 font-semibold">{t("analyzer.colType")}</th>
                      <th className="px-4 py-2.5 font-semibold">{t("analyzer.colNonEmpty")}</th>
                      <th className="px-4 py-2.5 font-semibold">{t("analyzer.colMissing")}</th>
                      <th className="px-4 py-2.5 font-semibold">{t("analyzer.colSum")}</th>
                      <th className="px-4 py-2.5 font-semibold">{t("analyzer.colAvg")}</th>
                      <th className="px-4 py-2.5 font-semibold">{t("analyzer.colMin")}</th>
                      <th className="px-4 py-2.5 font-semibold">{t("analyzer.colMax")}</th>
                      <th className="px-4 py-2.5 font-semibold">{t("analyzer.colUnique")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.columns.map((c) => (
                      <tr key={c.name} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{c.name}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{t(TYPE_KEYS[c.type])}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{formatNumber(c.nonEmpty)}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{formatNumber(c.missing)}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{c.sum !== undefined ? formatNumber(c.sum) : "—"}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{c.avg !== undefined ? formatNumber(c.avg) : "—"}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{c.min !== undefined ? formatNumber(Number(c.min)) : "—"}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{c.max !== undefined ? formatNumber(Number(c.max)) : "—"}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{c.unique !== undefined ? formatNumber(c.unique) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("analyzer.previewTitle")} />
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                      {result.preview[0].map((h, i) => (
                        <th key={i} className="px-3 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.preview.slice(1).map((row, ri) => (
                      <tr key={ri} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
