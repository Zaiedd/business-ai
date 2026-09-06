"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Download, FileText, Loader2, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

interface CompanyFile {
  id: string;
  originalName: string;
  mimeType: string;
  ext: string;
  size: number;
  analysis: string | null;
  createdAt: string;
  uploadedBy: { name: string } | null;
}

const MAX_MB = 25;

const EXT_COLORS: Record<string, string> = {
  pdf: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300",
  xlsx: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
  xls: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
  csv: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
  json: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
  txt: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  png: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300",
  jpg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300",
  jpeg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300",
  zip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  doc: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300",
  docx: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300",
};

function formatSize(bytes: number, locale: string = "en"): string {
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: n >= 100 || i === 0 ? 0 : 1 })} ${units[i]}`;
}

export default function CompanyFiles() {
  const { t, locale } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/company-files", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("companyFiles.uploadFailed"));
      setFiles(body.data.files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("companyFiles.uploadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFile(file: File) {
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(t("companyFiles.sizeHint", { max: String(MAX_MB) }));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/company-files", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("companyFiles.uploadFailed"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("companyFiles.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("companyFiles.deleteConfirm"))) return;
    const res = await fetch(`/api/company-files?id=${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? t("companyFiles.deleteFailed"));
      return;
    }
    setFiles((f) => f.filter((x) => x.id !== id));
  }

  return (
    <Card>
      <CardHeader
        title={t("companyFiles.title")}
        subtitle={t("companyFiles.subtitle")}
        actions={
          <Button type="button" variant="secondary" size="sm" loading={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? null : <UploadCloud className="size-4" />}
            {uploading ? t("companyFiles.uploading") : t("companyFiles.upload")}
          </Button>
        }
      />
      <CardBody className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />

        <p className="text-xs text-slate-400 dark:text-slate-500">
          {t("companyFiles.acceptedTypes")} · {t("companyFiles.sizeHint", { max: String(MAX_MB) })}
        </p>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            {t("companyFiles.uploading")}
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t("companyFiles.empty")}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t("companyFiles.emptyHint")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {files.map((f) => (
              <li key={f.id} className="py-3">
                <div className="flex items-center gap-3">
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", EXT_COLORS[f.ext] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{f.originalName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatSize(f.size, locale)} · {new Date(f.createdAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
                      {f.uploadedBy?.name ? ` · ${t("companyFiles.uploadedBy", { name: f.uploadedBy.name })}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {f.analysis && (
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === f.id ? null : f.id)}
                        className={cn(
                          "rounded-lg p-2 transition-colors",
                          expanded === f.id ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300",
                        )}
                        title={t("companyFiles.analysis")}
                      >
                        <Sparkles className="size-4" />
                      </button>
                    )}
                    <a
                      href={`/api/files/download?id=${f.id}`}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
                      title={t("companyFiles.download")}
                    >
                      <Download className="size-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => remove(f.id)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                      title={t("companyFiles.delete")}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                {expanded === f.id && f.analysis && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                      <Sparkles className="size-3" />
                      {t("companyFiles.analysis")}
                    </p>
                    <p className="whitespace-pre-wrap">{f.analysis}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
