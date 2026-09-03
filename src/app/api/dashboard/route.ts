import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { DashboardData } from "@/lib/fleet-types";

export const dynamic = "force-dynamic";

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

/** GET /api/dashboard — all stats for the overview page */
export async function GET() {
  const [trips, finance, ledger] = await Promise.all([
    db.trip.findMany({ orderBy: { startTime: "desc" } }),
    db.financialEntry.findMany({}),
    db.ledgerEntry.findMany({}),
  ]);

  /* Totals */
  let distanceKm = 0, revenue = 0, expenses = 0, credited = 0, paid = 0;
  for (const t of trips) distanceKm += t.distanceKm;
  for (const f of finance) {
    if (f.type === "REVENUE") revenue += f.amount;
    else expenses += f.amount;
  }
  for (const l of ledger) {
    if (l.type === "CREDIT") credited += l.amount; else paid += l.amount;
  }

  /* Trips today (UTC wall-clock date of "now") */
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const todayTrips = trips.filter((t) => t.startTime.getTime() >= todayStart);
  const vehiclesToday = new Set(todayTrips.map((t) => t.vehicleName)).size;

  /* Last 14 days distance series */
  const daily = new Map<string, { km: number; trips: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayStart - i * 86400000);
    daily.set(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, { km: 0, trips: 0 });
  }
  for (const t of trips) {
    const key = `${t.startTime.getUTCFullYear()}-${pad(t.startTime.getUTCMonth() + 1)}-${pad(t.startTime.getUTCDate())}`;
    const e = daily.get(key);
    if (e) { e.km += t.distanceKm; e.trips += 1; }
  }

  /* Last 6 months revenue vs expenses */
  const monthly = new Map<string, { revenue: number; expenses: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthly.set(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`, { revenue: 0, expenses: 0 });
  }
  for (const f of finance) {
    const key = `${f.entryDate.getUTCFullYear()}-${pad(f.entryDate.getUTCMonth() + 1)}`;
    const e = monthly.get(key);
    if (!e) continue;
    if (f.type === "REVENUE") e.revenue += f.amount; else e.expenses += f.amount;
  }

  /* Expense breakdown by category */
  const exp = new Map<string, number>();
  for (const f of finance) {
    if (f.type !== "EXPENSE") continue;
    exp.set(f.category, (exp.get(f.category) || 0) + f.amount);
  }

  const data: DashboardData = {
    totals: {
      distanceKm: Math.round(distanceKm * 100) / 100,
      trips: trips.length,
      revenue: Math.round(revenue),
      expenses: Math.round(expenses),
      netProfit: Math.round(revenue - expenses),
      pendingDues: Math.round(credited - paid),
      ledgerCredited: Math.round(credited),
      ledgerPaid: Math.round(paid),
    },
    tripsToday: todayTrips.length,
    vehiclesToday,
    distance14d: [...daily.entries()].map(([date, e]) => ({ date, km: Math.round(e.km * 10) / 10, trips: e.trips })),
    monthly: [...monthly.entries()].map(([month, e]) => ({
      month,
      revenue: Math.round(e.revenue),
      expenses: Math.round(e.expenses),
    })),
    expenseBreakdown: [...exp.entries()]
      .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount),
    recentTrips: trips.slice(0, 6),
    isEmpty: trips.length === 0 && finance.length === 0 && ledger.length === 0,
  };

  return NextResponse.json(data);
}
