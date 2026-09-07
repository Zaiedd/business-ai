"use client";

import { AlertTriangle, CheckCircle2, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HealthGauge } from "@/components/dashboard/health-gauge";
import RadarChart from "@/components/charts/radar-chart";
import RadarGrid from "@/components/charts/radar-grid";
import RadarAxis from "@/components/charts/radar-axis";
import RadarArea from "@/components/charts/radar-area";
import RadarLabels from "@/components/charts/radar-labels";
import { useI18n } from "@/components/i18n-provider";
import type { HealthReportBundle } from "@/server/health";

export interface HealthReportViewData {
  meta: HealthReportBundle["meta"];
  headline: HealthReportBundle["headline"];
  areas: HealthReportBundle["areas"];
  kpis: HealthReportBundle["kpis"];
  diagnosis: string[];
  risks: HealthReportBundle["risks"];
  opportunities: HealthReportBundle["opportunities"];
  actionPlan: HealthReportBundle["actionPlan"];
}

function sigIcon(status: string) {
  if (status === "good") return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />;
  if (status === "bad") return <AlertTriangle className="size-3.5 shrink-0 text-rose-500" />;
  return <Minus className="size-3.5 shrink-0 text-slate-400" />;
}

function areaColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 65) return "bg-emerald-400";
  if (score >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function kpiDelta(v: number | null, good: boolean) {
  if (v === null) return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
  const positive = v >= 0;
  const goodColor = good ? positive : !positive;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", goodColor ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
      <Icon className="size-3" />
      {positive ? "+" : ""}{v.toFixed(1)}%
    </span>
  );
}

function priorityBadge(p: string) {
  if (p === "high") return <Badge variant="critical">high</Badge>;
  if (p === "medium") return <Badge variant="warning">medium</Badge>;
  return <Badge variant="neutral">low</Badge>;
}

export function HealthReportView({ data }: { data: HealthReportViewData }) {
  const { t } = useI18n();
  return (
    <div className="print-area space-y-6">
      {data.headline.score === null && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardBody className="flex items-center gap-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0" /> {t("health.noData")}
          </CardBody>
        </Card>
      )}

      {/* Headline */}
      <Card>
        <CardBody className="grid gap-6 md:grid-cols-[auto_1fr]">
          <HealthGauge score={data.headline.score ?? 0} label={data.headline.statusLabel} />
          <div className="flex flex-col justify-center gap-3 py-2">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{t("health.headlineLabel")}</p>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-block size-2 rounded-full bg-slate-300" />
                {t("health.periodLabel", { period: t(`health.periodValues.${data.meta.period}`) })} · {data.meta.from} → {data.meta.to}
              </div>
              {data.headline.change !== null && (
                <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", data.headline.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {data.headline.change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {data.headline.change >= 0 ? t("health.changeUp", { pct: String(data.headline.change) }) : t("health.changeDown", { pct: String(Math.abs(data.headline.change)) })}
                </span>
              )}
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">{data.headline.summary}</p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                {t("health.prevLabel")}: {data.headline.prevScore === null ? "—" : data.headline.prevScore}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">{data.meta.companyName}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Areas */}
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="lg:col-span-1 xl:col-span-2">
          <CardHeader title={t("health.radarLabel")} subtitle={t("health.radarSubtitle")} />
          <CardBody>
            <div className="mx-auto aspect-square max-w-[380px]">
              <RadarChart
                data={[
                  {
                    label: t("health.headlineLabel"),
                    color: "var(--chart-1)",
                    values: Object.fromEntries(data.areas.map((a) => [a.key, a.score])),
                  },
                ]}
                metrics={data.areas.map((a) => ({ key: a.key, label: a.label }))}
              >
                <RadarGrid />
                <RadarAxis />
                <RadarArea index={0} />
                <RadarLabels />
              </RadarChart>
            </div>
          </CardBody>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 lg:col-span-2 xl:col-span-4">
          {data.areas.map((a) => (
            <Card key={a.key}>
              <CardBody className="space-y-3 px-4 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{a.label}</p>
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{a.score}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className={cn("h-full rounded-full", areaColor(a.score))} style={{ width: `${a.score}%` }} />
                </div>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{a.summary}</p>
                <ul className="space-y-1.5">
                  {a.signals.map((s) => (
                    <li key={s.key} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        {sigIcon(s.status)} <span className="truncate">{s.label}</span>
                      </span>
                      <span className={cn("shrink-0 font-semibold", s.status === "good" ? "text-emerald-600 dark:text-emerald-400" : s.status === "bad" ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300")}>{s.value}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* KPIs + summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("health.detailLabel")} />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                    <th className="pb-2 font-medium">{t("health.metricLabel")}</th>
                    <th className="pb-2 text-right font-medium">{t("health.prevLabel")}</th>
                    <th className="pb-2 text-right font-medium">{t("health.period")}</th>
                    <th className="pb-2 text-right font-medium">{t("dashboard.kpis.vsPrevious")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.kpis.map((k) => (
                    <tr key={k.key}>
                      <td className="py-2.5 text-slate-700 dark:text-slate-300">{k.label}</td>
                      <td className="py-2.5 text-right text-slate-500 dark:text-slate-400">{k.previous}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-900 dark:text-slate-100">{k.current}</td>
                      <td className="py-2.5 text-right">{kpiDelta(k.deltaPct, k.goodWhenUp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("health.summaryLabel")} />
          <CardBody className="space-y-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <p>{data.headline.summary}</p>
          </CardBody>
        </Card>
      </div>

      {/* Diagnosis */}
      <Card>
        <CardHeader title={t("health.diagnosisLabel")} />
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.diagnosis.map((d) => (
              <div key={d} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                <SearchIcon />
                {d}
              </div>
            ))}
            {data.diagnosis.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("health.diagnosis.none")}</p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Risks + Opportunities */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("health.risksLabel")} actions={<Badge variant="warning">{data.risks.length}</Badge>} />
          <CardBody className="space-y-2.5">
            {data.risks.map((r) => (
              <div key={r.title} className={cn("rounded-lg border p-3", r.severity === "high" ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40" : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40")}>
                <div className="flex items-center gap-2">
                  {priorityBadge(r.severity)}
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.title}</p>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{r.description}</p>
              </div>
            ))}
            {data.risks.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("health.diagnosis.none")}</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("health.oppsLabel")} actions={<Badge variant="brand">{data.opportunities.length}</Badge>} />
          <CardBody className="space-y-2.5">
            {data.opportunities.map((o) => (
              <div key={o.title} className="rounded-lg border border-indigo-100 p-3 dark:border-indigo-900/60">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{o.title}</p>
                <p className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">{o.impact}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{o.description}</p>
              </div>
            ))}
            {data.opportunities.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t("health.diagnosis.none")}</p>}
          </CardBody>
        </Card>
      </div>

      {/* Action plan */}
      <Card>
        <CardHeader title={t("health.planLabel")} />
        <CardBody>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.actionPlan.map((a) => (
              <div key={a.action} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  {priorityBadge(a.priority)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{a.action}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{a.area}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{a.impact}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-4 shrink-0 text-slate-400">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}