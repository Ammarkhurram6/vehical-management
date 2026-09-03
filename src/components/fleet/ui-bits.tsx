"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FINANCE_CATEGORIES, type FinanceCategory } from "@/lib/fleet-types";

export { api } from "@/lib/fleet-utils";

/* ---------------------------------------------------------------- */
/*  Motion presets                                                   */
/* ---------------------------------------------------------------- */

export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" as const },
};

export const stagger = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: i * 0.07, ease: "easeOut" as const },
});

/* ---------------------------------------------------------------- */
/*  Stat card                                                        */
/* ---------------------------------------------------------------- */

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  iconClass?: string; // tile color classes
  valueClass?: string;
  delay?: number;
  onClick?: () => void;
  asButton?: boolean;
}

export function StatCard({ label, value, sub, icon: Icon, iconClass, valueClass, delay = 0, onClick }: StatCardProps) {
  const Wrapper = onClick ? motion.button : motion.div;
  return (
    <Wrapper
      {...stagger(delay)}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 text-left shadow-sm transition-all",
        onClick && "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-100/60 to-transparent blur-xl transition-opacity group-hover:opacity-80" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-slate-500">{label}</p>
          <p className={cn("mt-1.5 whitespace-nowrap text-[24px] font-bold leading-tight tracking-tight tabular-nums", valueClass || "text-slate-900")}>
            {value}
          </p>
          {sub && <p className="mt-1 text-[11px] leading-4 text-slate-400">{sub}</p>}
        </div>
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", iconClass || "bg-emerald-100 text-emerald-600")}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Wrapper>
  );
}

/* ---------------------------------------------------------------- */
/*  Card with header                                                 */
/* ---------------------------------------------------------------- */

export function SectionCard({ title, subtitle, action, children, className, delay = 0 }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div {...stagger(delay)} className={cn("min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- */
/*  Skeleton                                                         */
/* ---------------------------------------------------------------- */

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl border border-slate-200/60 bg-slate-200/40", className)} />;
}

/* ---------------------------------------------------------------- */
/*  Badges                                                           */
/* ---------------------------------------------------------------- */

const VEHICLE_COLORS = ["#0d9488", "#b45309", "#7c3aed", "#be185d", "#4d7c0f", "#9f1239", "#a16207"];

export function VehicleBadge({ name }: { name: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const color = VEHICLE_COLORS[Math.abs(hash) % VEHICLE_COLORS.length];
  return (
    <span
      className="inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-[11px] font-semibold leading-5"
      style={{ backgroundColor: `${color}14`, color }}
      title={name}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const meta = FINANCE_CATEGORIES[category as FinanceCategory] ?? { label: category, color: "#64748b" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold leading-5"
      style={{ backgroundColor: `${meta.color}14`, color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/*  Chart tooltip                                                    */
/* ---------------------------------------------------------------- */

export function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string | number }[];
  label?: string;
  formatter?: (v: number, key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur">
      {label && <p className="mb-1 text-xs font-semibold text-slate-700">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-800">
              {formatter ? formatter(p.value ?? 0, String(p.dataKey)) : (p.value ?? 0).toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Empty state                                                      */
/* ---------------------------------------------------------------- */

export function EmptyState({ icon: Icon, title, description, action, className }: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center", className)}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <Icon className="h-7 w-7" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
