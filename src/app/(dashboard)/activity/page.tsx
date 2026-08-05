"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";

interface AuditEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: string | null;
  ip: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

export default function ActivityPage() {
  const { t, locale } = useI18n();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => setLogs(b.data?.logs ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  function actionLabel(action: string): string {
    const key = `activity.actions.${action}`;
    const label = t(key);
    return label !== key ? label : action;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("activity.title")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("activity.subtitle")}</p>
      </div>

      <Card>
        <CardHeader title={t("activity.cardTitle")} subtitle={t("activity.cardSubtitle")} actions={<Badge variant="info"><ShieldCheck className="size-3" />{t("activity.audited")}</Badge>} />
        <CardBody>
          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{t("activity.empty")}</p>
          ) : (
            <ul className="space-y-1">
              {logs.map((l) => (
                <li key={l.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-indigo-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{actionLabel(l.action)}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{t("activity.by", { name: l.user?.name ?? t("common.system") })}</span>
                    </div>
                    {l.entity && <p className="text-xs text-slate-500 dark:text-slate-400">{l.entity}</p>}
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(l.createdAt, locale)}</p>
                    {l.ip && <p className="text-[10px] text-slate-400 dark:text-slate-500">{l.ip}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
