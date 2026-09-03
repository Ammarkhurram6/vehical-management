import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/trips?vehicle=&month=YYYY-MM
 *  Returns trips (newest first) + meta (vehicles list, aggregates). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const vehicle = sp.get("vehicle") || undefined;
  const month = sp.get("month") || undefined; // YYYY-MM

  const where: Record<string, unknown> = {};
  if (vehicle && vehicle !== "all") where.vehicleName = vehicle;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1));
    const to = new Date(Date.UTC(y, m, 1));
    where.tripDate = { gte: from, lt: to };
  }

  const trips = await db.trip.findMany({
    where,
    orderBy: [{ tripDate: "desc" }, { startTime: "desc" }],
    take: 1000,
  });

  const allVehicles = await db.trip.findMany({
    distinct: ["vehicleName"],
    select: { vehicleName: true },
    orderBy: { vehicleName: "asc" },
  });

  const totalKm = trips.reduce((s, t) => s + t.distanceKm, 0);
  const totalMin = trips.reduce((s, t) => s + t.durationMin, 0);

  return NextResponse.json({
    trips,
    meta: {
      count: trips.length,
      totalKm: Math.round(totalKm * 100) / 100,
      totalMinutes: totalMin,
      avgKm: trips.length ? Math.round((totalKm / trips.length) * 100) / 100 : 0,
      vehicles: allVehicles.map((v) => v.vehicleName),
    },
  });
}

/** DELETE /api/trips — clear all trip records */
export async function DELETE() {
  await db.trip.deleteMany({});
  return NextResponse.json({ ok: true });
}
