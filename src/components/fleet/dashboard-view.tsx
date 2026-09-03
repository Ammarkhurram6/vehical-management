"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar,
} from "recharts";
import {
  Route, IndianRupee, Navigation, Wallet, ArrowRight, MapPin,
  Sparkles, Upload, RefreshCw,
} from "lucide-react";
import type { DashboardData } from "@/lib/fleet-types";
import { FINANCE_CATEGORIES } from "@/lib/fleet-types";
import { fmtINR, fmtINRCompact, fmtNum, fmtDateTime } from "@/lib/format";
import { StatCard, SectionCard, SkeletonCard, ChartTooltip, EmptyState, api, stagger } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  refreshKey: number;
  onNavigate: (view: "trips" | "finance" | "ledger") => void;
  onChanged: () => void;
}

export default function DashboardView({ refreshKey, onNavigate, onChanged }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setData(await api<DashboardData>("/api/dashboard"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);
  const seedDemo = async () => {
    setSeeding(true);
    try {
      await api("/api/demo", {
        method: "POST",
        body: JSON.stringify({ force: true, tzOffsetMinutes: new Date().getTimezoneOffset() }),
      });
      toast.success("Demo fleet data loaded — 3 vehicles, 35 days of routes");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} className="h-[104px]" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <SkeletonCard className="h-[360px] lg:col-span-3" />
          <SkeletonCard className="h-[360px] lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (data.isEmpty) {
    return (
      <motion.div {...stagger(0)}>
        <EmptyState
          icon={Sparkles}
          title="Welcome to FleetFlow"
          description="Load a demo fleet to explore the dashboard with 35 days of GPS trips, profit calculations and Saqib's ledger — or upload your own tracking CSV to start fresh."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={seedDemo} disabled={seeding} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                {seeding ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {seeding ? "Generating…" : "Load demo data"}
              </Button>
              <Button variant="outline" onClick={() => onNavigate("trips")}>
                <Upload className="mr-2 h-4 w-4" /> Upload CSV
              </Button>
            </div>
          }
        />
      </motion.div>
    );
  }

  const t = data.totals;
  const profitPositive = t.netProfit >= 0;
  const maxExpense = data.expenseBreakdown[0]?.amount || 1;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Fleet Distance" value={fmtNum(t.distanceKm) + " km"} sub={`${t.trips} trips recorded`} icon={Route} iconClass="bg-emerald-100 text-emerald-600" delay={0} />
        <StatCard label="Net Profit" value={fmtINR(t.netProfit)} sub={`Rev ${fmtINRCompact(t.revenue)} • Exp ${fmtINRCompact(t.expenses)}`} icon={IndianRupee}
          iconClass={profitPositive ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}
          valueClass={profitPositive ? "text-emerald-700" : "text-rose-600"} delay={1}
          onClick={() => onNavigate("finance")} />
        <StatCard label="Trips Today" value={String(data.tripsToday)} sub={data.vehiclesToday > 0 ? `${data.vehiclesToday} vehicle(s) on road` : "No movement logged yet"} icon={Navigation} iconClass="bg-amber-100 text-amber-600" delay={2} />
        <StatCard label="Pending Manager Dues" value={fmtINR(t.pendingDues)} sub="Saqib — hisab kitab" icon={Wallet} iconClass="bg-orange-100 text-orange-600" valueClass={t.pendingDues > 0 ? "text-orange-600" : "text-emerald-700"} delay={3} onClick={() => onNavigate("ledger")} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCard title="Distance Trend" subtitle="Fleet km per day — last 14 days" className="lg:col-span-3" delay={2}>
          <div className="h-[264px] w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.distance14d} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="kmFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(8) + "/" + v.slice(5, 7)} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={46} />
                <Tooltip content={<ChartTooltip formatter={(v) => fmtNum(v) + " km"} />} />
                <Area type="monotone" dataKey="km" name="Distance" stroke="#10b981" strokeWidth={2.5} fill="url(#kmFill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Expense Breakdown" subtitle="Where the money goes" className="lg:col-span-2" delay={3}>
          {data.expenseBreakdown.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No expenses recorded yet</p>
          ) : (
            <div className="space-y-3.5">
              {data.expenseBreakdown.slice(0, 6).map((e, i) => {
                const meta = FINANCE_CATEGORIES[e.category as keyof typeof FINANCE_CATEGORIES] ?? { label: e.category, color: "#64748b" };
                return (
                  <div key={e.category} className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="truncate font-medium text-slate-700">{meta.label}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-slate-800">{fmtINR(e.amount)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <motion.div className="h-full rounded-full" style={{ backgroundColor: meta.color }}
                          initial={{ width: 0 }} animate={{ width: `${(e.amount / maxExpense) * 100}%` }}
                          transition={{ duration: 0.7, delay: 0.15 + i * 0.06, ease: "easeOut" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => onNavigate("finance")} className="pt-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                Manage finances →
              </button>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Revenue vs expenses + recent trips */}
      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCard title="Revenue vs Expenses" subtitle="Last 6 months" className="lg:col-span-3" delay={4}>
          <div className="h-[240px] w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly.map((m) => ({ ...m, label: m.month.slice(5) + "/" + m.month.slice(2, 4) }))} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={5}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v: number) => fmtINRCompact(v).replace("₹", "")} />
                <Tooltip content={<ChartTooltip formatter={(v) => fmtINR(v)} />} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={26} />
                <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[5, 5, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Recent Trips" subtitle="Latest routes recorded" className="lg:col-span-2" delay={5}
          action={<button onClick={() => onNavigate("trips")} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">View all</button>}>
          <div className="space-y-1">
            {data.recentTrips.map((trip) => (
              <div key={trip.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-slate-800">
                    <span className="max-w-[110px] truncate">{trip.startLocation}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-slate-300" />
                    <span className="max-w-[110px] truncate">{trip.endLocation}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="truncate max-w-[130px]">{trip.vehicleName}</span>•<span>{fmtDateTime(trip.startTime)}</span>
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold tabular-nums text-emerald-700">
                  {fmtNum(trip.distanceKm)} km
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
