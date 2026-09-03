import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

function keyFor(d: Date, granularity: string): { key: string; sort: number } {
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  if (granularity === "monthly") {
    return { key: `${y}-${pad(m + 1)}`, sort: Date.UTC(y, m, 1) };
  }
  if (granularity === "weekly") {
    // ISO week starting Monday
    const dow = (d.getUTCDay() + 6) % 7; // Mon=0
    const monday = new Date(Date.UTC(y, m, day - dow));
    return { key: `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`, sort: monday.getTime() };
  }
  return { key: `${y}-${pad(m + 1)}-${pad(day)}`, sort: Date.UTC(y, m, day) };
}

/** GET /api/trips/summary?granularity=daily|weekly|monthly&month=YYYY-MM&vehicle=
 *  Aggregated trip totals per period. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const granularity = ["daily", "weekly", "monthly"].includes(sp.get("granularity") || "")
    ? sp.get("granularity")!
    : "daily";
  const month = sp.get("month") || undefined;
  const vehicle = sp.get("vehicle") || undefined;

  const where: Record<string, unknown> = {};
  if (vehicle && vehicle !== "all") where.vehicleName = vehicle;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    where.tripDate = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
  } else if (granularity !== "monthly") {
    // Default to current month for daily/weekly views to keep charts readable
    const now = new Date();
    where.tripDate = { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) };
  }

  const trips = await db.trip.findMany({ where, orderBy: { startTime: "asc" } });

  const map = new Map<number, { key: string; trips: number; km: number; minutes: number; vehicles: Set<string> }>();
  for (const t of trips) {
    const { key, sort } = keyFor(t.startTime, granularity);
    if (!map.has(sort)) map.set(sort, { key, trips: 0, km: 0, minutes: 0, vehicles: new Set() });
    const e = map.get(sort)!;
    e.trips += 1;
    e.km += t.distanceKm;
    e.minutes += t.durationMin;
    e.vehicles.add(t.vehicleName);
  }

  const summary = [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, e]) => ({
      period: e.key,
      trips: e.trips,
      km: Math.round(e.km * 100) / 100,
      minutes: e.minutes,
      vehicles: e.vehicles.size,
    }));

  return NextResponse.json({ granularity, summary });
}
