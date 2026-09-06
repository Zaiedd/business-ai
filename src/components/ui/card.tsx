import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Card({ className, children, hover }: { className?: string; children: React.ReactNode; hover?: boolean }) {
  if (hover) {
    return (
      <motion.div
        whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className={cn("rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>{children}</div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800", className)}>
      <div>
        <h3 className="text-sm font-semibold leading-relaxed text-slate-900 dark:text-slate-100">{title}</h3>
        {subtitle && <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
