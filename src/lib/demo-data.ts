import { db } from "@/lib/db";
import { extractTrips, type ParsedGpsRow } from "@/lib/trip-parser";
import { FINANCE_CATEGORIES, OPENING_BALANCE, type FinanceCategory } from "@/lib/fleet-types";

/* Demo data generator: builds a realistic 35-day GPS feed for 3 vehicles
   (as raw GPS rows), then pushes it through the SAME trip-extraction engine
   used by CSV uploads, so the demo also proves the parsing logic works. */

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

const VEHICLES = [
  "DL 01 AB 1234 (Tata 407)",
  "HR 26 DK 8890 (Ashok Leyland Dost)",
  "UP 16 CT 4455 (Eicher Pro 2049)",
];

const PLACES = [
  "Okhla Industrial Area Phase 2, New Delhi",
  "Connaught Place, New Delhi",
  "Gurugram Sector 32, Haryana",
  "Noida Sector 62, UP",
  "Azadpur Mandi, New Delhi",
  "Ghazipur Mandi, New Delhi",
  "IGI Airport Cargo Terminal, New Delhi",
  "Faridabad Sector 15, Haryana",
  "Kundli Industrial Area, Sonipat",
  "Ballabhgarh Market, Haryana",
  "Sahibabad Industrial Area, Ghaziabad",
  "Naraina Industrial Area, New Delhi",
];

const DISTANCES = [12, 28, 34, 45, 52, 63, 74, 88, 95, 110, 126, 142, 168];

/** Simple deterministic-ish RNG (seeded) so demo data is stable per day */
function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GpsLogRow {
  ts: Date; lat: number; lng: number; location: string;
  ignition: boolean; speed: number; odo: number; vehicle: string;
}

export async function generateDemoData(userTzOffsetMinutes: number = 0) {
  /* "Now" in the user's local time, expressed as UTC wall clock */
  const nowLocal = new Date(Date.now() - userTzOffsetMinutes * 60000);
  const todayUtc = Date.UTC(
    nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate(), 
    nowLocal.getUTCHours(), nowLocal.getUTCMinutes()
  );

  const odometers = [45230.5, 78412.2, 120377.8];
  const rows: GpsLogRow[] = [];
  const rand = mulberry(20260903);

  for (let day = 34; day >= 0; day--) {
    const dayStart = todayUtc - day * 86400000;
    VEHICLES.forEach((vehicle, vi) => {
      if (rand() < 0.14 && day > 0) return; // some off days
      const numTrips = day === 0 ? (rand() < 0.5 ? 1 : 2) : 1 + Math.floor(rand() * 3); // 1-3 trips
      let odo = odometers[vi];
      let cursor = dayStart + (6 + rand() * 1.5) * 3600000; // start ~6:00-7:30 AM

      for (let t = 0; t < numTrips; t++) {
        const from = PLACES[Math.floor(rand() * PLACES.length)];
        let to = PLACES[Math.floor(rand() * PLACES.length)];
        if (to === from) to = PLACES[(PLACES.indexOf(from) + 3) % PLACES.length];
        const distance = DISTANCES[Math.floor(rand() * DISTANCES.length)];
        const speedKmh = 28 + rand() * 34;
        const driveMin = Math.max(18, Math.round((distance / speedKmh) * 60));

        // Ignition ON row
        odometers[vi] = odo;
        rows.push({
          ts: new Date(cursor), lat: 28.5 + rand() * 0.4, lng: 77.0 + rand() * 0.4,
          location: from, ignition: true, speed: 0, odo, vehicle,
        });
        // a few in-between pings
        const pings = Math.max(2, Math.floor(driveMin / 9));
        for (let p = 1; p <= pings; p++) {
          const prog = p / (pings + 1);
          cursor += (driveMin / (pings + 1)) * 60000;
          odo += (distance * prog) / (pings + 1);
          rows.push({
            ts: new Date(cursor), lat: 28.5 + rand() * 0.4, lng: 77.0 + rand() * 0.4,
            location: `En route (via NH-${1 + Math.floor(rand() * 48)})`, ignition: true,
            speed: Math.round(speedKmh * (0.6 + rand() * 0.6)), odo, vehicle,
          });
        }
        // arrival
        cursor += driveMin * 60000 * 0.2;
        odo += distance / (pings + 1);
        rows.push({
          ts: new Date(cursor), lat: 28.5 + rand() * 0.4, lng: 77.0 + rand() * 0.4,
          location: to, ignition: false, speed: 0, odo, vehicle,
        });
        // dwell 35min - 2.5h before next trip
        cursor += (35 + rand() * 115) * 60000;
      }
    });
  }

  rows.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  /* Push raw GPS rows through the same engine the CSV upload uses */
  const parsed: ParsedGpsRow[] = rows.map((r) => ({
    ts: r.ts, lat: r.lat, lng: r.lng, location: r.location,
    ignition: r.ignition, speed: r.speed, odo: r.odo, vehicle: r.vehicle,
  }));
  const { trips } = extractTrips(parsed);

  await db.trip.createMany({
    data: trips.map((t) => ({
      vehicleName: t.vehicleName,
      tripDate: t.tripDate,
      startTime: t.startTime,
      endTime: t.endTime,
      startLocation: t.startLocation,
      endLocation: t.endLocation,
      distanceKm: t.distanceKm,
      maxSpeed: t.maxSpeed,
      avgSpeed: t.avgSpeed,
      durationMin: t.durationMin,
      sourceFile: "demo-data",
    })),
  });

  /* Financial entries derived from the generated trips */
  const finance: {
    type: string; category: string; amount: number; description: string;
    vehicleName: string | null; entryDate: Date;
  }[] = [];

  const byDay = new Map<string, typeof trips>();
  for (const t of trips) {
    const key = `${t.tripDate.getTime()}-${t.vehicleName}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(t);
  }

  for (const [, dayTrips] of byDay) {
    const km = dayTrips.reduce((s, t) => s + t.distanceKm, 0);
    const d = dayTrips[0];
    if (rand() < 0.82) {
      const rent = Math.round((2500 + km * (28 + rand() * 26)) / 50) * 50;
      finance.push({
        type: "REVENUE", category: "TRIP_RENT", amount: rent,
        description: `Trip rent — ${dayTrips.length} trip(s), ${Math.round(km)} km`,
        vehicleName: d.vehicleName, entryDate: d.startTime,
      });
    }
    // Diesel: ~4.2 km/L @ ~₹89/L
    finance.push({
      type: "EXPENSE", category: "DIESEL",
      amount: Math.round((km / 4.2) * 89),
      description: `Diesel — ${Math.round(km)} km @ 4.2 km/L`,
      vehicleName: d.vehicleName, entryDate: d.startTime,
    });
  }

  // Weekly driver pay per vehicle
  for (let w = 4; w >= 0; w--) {
    for (const v of VEHICLES) {
      const when = new Date(todayUtc - w * 7 * 86400000);
      finance.push({
        type: "EXPENSE", category: "DRIVER_PAY",
        amount: 2800 + Math.round(rand() * 900),
        description: `Weekly driver payment — week of ${when.getUTCDate()}/${when.getUTCMonth() + 1}`,
        vehicleName: v, entryDate: when,
      });
    }
  }

  // A few challans, tolls and maintenance
  for (let i = 0; i < 4; i++) {
    const when = new Date(todayUtc - Math.floor(rand() * 32) * 86400000);
    finance.push({
      type: "EXPENSE", category: "CHALLAN",
      amount: 500 + Math.round(rand() * 15) * 100,
      description: ["Over-speeding camera, NH-48", "No-entry violation", "Parking challan", "Overload check fine"][i],
      vehicleName: VEHICLES[Math.floor(rand() * 3)], entryDate: when,
    });
  }
  for (let i = 0; i < 5; i++) {
    const when = new Date(todayUtc - Math.floor(rand() * 33) * 86400000);
    finance.push({
      type: "EXPENSE", category: i % 2 === 0 ? "TOLL" : "MAINTENANCE",
      amount: i % 2 === 0 ? 350 + Math.round(rand() * 9) * 50 : 1200 + Math.round(rand() * 26) * 100,
      description: i % 2 === 0 ? "Toll (Fastag) recharge" : "Service / repair work",
      vehicleName: VEHICLES[Math.floor(rand() * 3)], entryDate: when,
    });
  }

  await db.financialEntry.createMany({ data: finance });

  /* Manager ledger — opening balance ₹130,000 as specified, then some clearing */
  const ledger = [
    {
      type: "CREDIT", amount: OPENING_BALANCE,
      description: "Opening pending balance — previous dues before tracking",
      entryDate: new Date(todayUtc - 35 * 86400000),
    },
    {
      type: "PAYMENT", amount: 30000,
      description: "Payment cleared via NEFT (ref #48213)",
      entryDate: new Date(todayUtc - 18 * 86400000),
    },
    {
      type: "CREDIT", amount: 42000,
      description: "Diesel advance given for contingency route",
      entryDate: new Date(todayUtc - 12 * 86400000),
    },
    {
      type: "PAYMENT", amount: 22000,
      description: "Cash payment received",
      entryDate: new Date(todayUtc - 5 * 86400000),
    },
  ];
  await db.ledgerEntry.createMany({ data: ledger });

  return {
    tripsCreated: trips.length,
    financeCreated: finance.length,
    ledgerCreated: ledger.length,
    vehicles: VEHICLES,
  };
}

export async function resetAllData() {
  await db.trip.deleteMany({});
  await db.financialEntry.deleteMany({});
  await db.ledgerEntry.deleteMany({});
}

export const DEMO_VEHICLES = VEHICLES;
export const DEMO_CATEGORIES = Object.keys(FINANCE_CATEGORIES) as FinanceCategory[];
