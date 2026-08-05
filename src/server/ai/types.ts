export type InsightSeverity = "success" | "info" | "warning" | "critical";

export interface Insight {
  id: string;
  type: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  recommendation?: string;
  metric?: { label: string; value: string; delta?: string };
}

export interface ForecastResult {
  horizonDays: number;
  predictedTotal: number;
  predictedAveragePerDay: number;
  growthRate: number; // predicted vs recent actual daily average
  trend: "up" | "down" | "flat";
  points: Array<{ date: string; value: number }>;
}
