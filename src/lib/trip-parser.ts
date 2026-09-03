import Papa from "papaparse";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ParsedGpsRow {
  ts: Date;
  lat: number | null;
  lng: number | null;
  location: string;
  ignition: boolean | null;
  speed: number;
  odo: number | null;
  vehicle: string;
}

export interface ExtractedTrip {
  vehicleName: string;
  tripDate: Date; // UTC midnight of start day
  startTime: Date;
  endTime: Date;
  startLocation: string;
  endLocation: string;
  distanceKm: number;
  maxSpeed: number;
  avgSpeed: number;
  durationMin: number;
}

export interface ParseReport {
  fileName: string;
  totalRows: number;
  usedRows: number;
  skippedRows: number;
  idleDropped: number;
  vehicles: string[];
  vehicleCounts: Record<string, number>;
  detected: Record<string, string | null>;
  ignitionMode: "ignition" | "fallback-daily";
  warnings: string[];
}

export interface CsvParseResult {
  trips: ExtractedTrip[];
  report: ParseReport;
}

/* ------------------------------------------------------------------ */
/*  Column detection                                                   */
/* ------------------------------------------------------------------ */

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

const COLUMN_MATCHERS: Record<string, (h: string) => boolean> = {
  timestamp: (h) =>
    ["timestamp", "gpstime", "datetime", "datetimeutc", "date", "time", "devicetime", "locationtime", "servertime", "datetimeist", "datetimegmt"].includes(h) ||
    (h.includes("date") && h.includes("time")) ||
    h === "datetime" ||
    (h === "date" || h === "time"),
  latitude: (h) => h === "latitude" || h === "lat" || h.endsWith("lat"),
  longitude: (h) => h === "longitude" || h === "long" || h === "lng" || h === "lon" || h.endsWith("lon"),
  location: (h) =>
    ["locationdescription", "location", "address", "place", "nearestaddress", "geocode", "locationname", "sitename"].includes(h) ||
    h.includes("location") ||
    h.includes("address"),
  ignition: (h) =>
    ["ignitionstatus", "ignition", "ign", "enginestatus", "engine", "accstatus", "acc", "status", "ignitiononoff"].includes(h),
  speed: (h) => h.includes("speed"),
  odometer: (h) =>
    ["totalodometer", "odometer", "odometerreading", "odometerkm", "totalkm", "totalkms", "odo", "odokm", "kmsreading", "totaldistance", "distancecovered"].includes(h) ||
    h.includes("odometer") ||
    h.includes("odometer") === false && h.includes("odo"),
  vehicle: (h) =>
    ["vehiclename", "vehicleno", "vehiclenumber", "vehicle", "plateno", "platenumber", "truckno", "trucknumber", "registrationno", "regno", "registrationnumber", "deviceid", "device", "imei", "fleetno"].includes(h) ||
    h.includes("vehicle") ||
    h.includes("plate") ||
    h.includes("truck"),
};

export function detectColumns(headers: string[]): Record<string, string | null> {
  const detected: Record<string, string | null> = {
    timestamp: null, latitude: null, longitude: null, location: null,
    ignition: null, speed: null, odometer: null, vehicle: null,
  };
  const used = new Set<string>();
  // Priority pass: exact-ish matches first so "Total Odometer" beats generic names
  const priority: Record<string, string[]> = {
    timestamp: ["timestamp", "gpstime", "datetime", "datetimeutc", "datetimeist", "devicetime", "date"],
    odometer: ["totalodometer", "odometer", "odometerreading", "odometerkm", "totalkm", "odo"],
    vehicle: ["vehiclename", "vehicleno", "vehicle", "plateno", "platenumber", "truckno", "regno", "deviceid"],
    location: ["locationdescription", "location", "address", "place"],
    ignition: ["ignitionstatus", "ignition", "enginestatus", "status"],
    latitude: ["latitude", "lat"],
    longitude: ["longitude", "long", "lng"],
    speed: ["speed"],
  };
  for (const [field, candidates] of Object.entries(priority)) {
    for (const c of candidates) {
      const hit = headers.find((h) => !used.has(h) && (norm(h) === c));
      if (hit) { detected[field] = hit; used.add(hit); break; }
    }
  }
  // Fuzzy pass for anything still missing
  for (const [field, matcher] of Object.entries(COLUMN_MATCHERS)) {
    if (detected[field]) continue;
    const hit = headers.find((h) => !used.has(h) && matcher(norm(h)));
    if (hit) { detected[field] = hit; used.add(hit); }
  }
  return detected;
}

/* ------------------------------------------------------------------ */
/*  Value parsing helpers                                              */
/* ------------------------------------------------------------------ */

export function parseTimestamp(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/^["']|["']$/g, "");
  if (!s) return null;

  // ISO style: 2025-08-01 06:30:00  /  2025-08-01T06:30  /  2025-08-01
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const [, y, mo, d, h, mi, se] = iso;
    return new Date(Date.UTC(+y, +mo - 1, +d, +(h ?? 0), +(mi ?? 0), +(se ?? 0)));
  }

  // Slash style: 01/08/2025 06:30 AM (day-first preferred, Indian tracking exports)
  const sl = s.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[T, ]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(am|pm)?/i
  );
  if (sl) {
    let d = +sl[1];
    let mo = +sl[2];
    if (mo > 12 && d <= 12) { [d, mo] = [mo, d]; } // month-first export
    let h = +(sl[4] ?? 0);
    const ap = sl[7]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    let y = +sl[3];
    if (y < 100) y += y > 70 ? 1900 : 2000;
    return new Date(Date.UTC(y, mo - 1, d, h, +(sl[5] ?? 0), +(sl[6] ?? 0)));
  }

  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
}

function toNumber(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).replace(/[",\s]/g, "").replace(/km\/?h?/i, "").replace(/km/i, "");
  if (!cleaned || cleaned === "-" || cleaned.toLowerCase() === "n/a") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function toIgnition(raw: string | undefined | null): boolean | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["on", "true", "1", "yes", "ignitionon", "engineon", "running", "moving", "start"].includes(s)) return true;
  if (["off", "false", "0", "no", "ignitionoff", "engineoff", "stopped", "idle", "end", "parked"].includes(s)) return false;
  return null;
}

/* Haversine distance in km */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const coordLabel = (r: ParsedGpsRow) =>
  r.lat !== null && r.lng !== null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : "Unknown point";

/* ------------------------------------------------------------------ */
/*  CSV text -> normalized GPS rows                                    */
/* ------------------------------------------------------------------ */

export function parseCsvRows(text: string): { rows: Record<string, string>[]; headers: string[] } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const rows = (result.data || []).filter(
    (r) => r && Object.values(r).some((v) => v !== null && String(v).trim() !== "")
  );
  const headers = (result.meta?.fields || []).filter(Boolean) as string[];
  return { rows, headers };
}

export function normalizeRows(
  rawRows: Record<string, string>[],
  detected: Record<string, string | null>
): { rows: ParsedGpsRow[]; skipped: number } {
  let skipped = 0;
  const out: ParsedGpsRow[] = [];
  for (const r of rawRows) {
    const ts = parseTimestamp(detected.timestamp ? r[detected.timestamp] : null);
    if (!ts) { skipped++; continue; }
    const lat = detected.latitude ? toNumber(r[detected.latitude]) : null;
    const lng = detected.longitude ? toNumber(r[detected.longitude]) : null;
    const location = (detected.location && r[detected.location] ? String(r[detected.location]).trim() : "") || "";
    const speed = detected.speed ? toNumber(r[detected.speed]) ?? 0 : 0;
    const odo = detected.odometer ? toNumber(r[detected.odometer]) : null;
    const vehicle = (detected.vehicle && r[detected.vehicle] ? String(r[detected.vehicle]).trim() : "") || "Unknown Vehicle";
    out.push({
      ts, lat, lng, location,
      ignition: detected.ignition ? toIgnition(r[detected.ignition]) : null,
      speed, odo, vehicle,
    });
  }
  out.sort((a, b) => a.ts.getTime() - b.ts.getTime());
  return { rows: out, skipped };
}

/* ------------------------------------------------------------------ */
/*  Trip extraction                                                    */
/* ------------------------------------------------------------------ */

function finalizeTrip(
  vehicle: string,
  rows: ParsedGpsRow[]
): ExtractedTrip | null {
  if (rows.length === 0) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];

  let distance = 0;
  const startOdo = (() => { for (const r of rows) if (r.odo !== null) return r.odo; return null; })();
  const endOdo = (() => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].odo !== null) return rows[i].odo; return null; })();

  if (startOdo !== null && endOdo !== null && endOdo >= startOdo) {
    distance = endOdo - startOdo;
  } else {
    // fallback: sum haversine of consecutive points
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i];
      if (a.lat !== null && a.lng !== null && b.lat !== null && b.lng !== null) {
        distance += haversineKm(a.lat, a.lng, b.lat, b.lng);
      }
    }
  }
  distance = Math.round(distance * 100) / 100;

  const durationMin = Math.max(0, Math.round((last.ts.getTime() - first.ts.getTime()) / 60000));
  const maxSpeed = rows.reduce((m, r) => Math.max(m, r.speed), 0);

  return {
    vehicleName: vehicle,
    tripDate: new Date(Date.UTC(first.ts.getUTCFullYear(), first.ts.getUTCMonth(), first.ts.getUTCDate())),
    startTime: first.ts,
    endTime: last.ts,
    startLocation: first.location || coordLabel(first),
    endLocation: last.location || coordLabel(last),
    distanceKm: distance,
    maxSpeed: Math.round(maxSpeed * 10) / 10,
    avgSpeed: durationMin > 3 ? Math.round((distance / (durationMin / 60)) * 10) / 10 : Math.round(distance * 10) / 10,
    durationMin,
  };
}

export function extractTrips(rows: ParsedGpsRow[]): { trips: ExtractedTrip[]; idleDropped: number; ignitionMode: "ignition" | "fallback-daily" } {
  const hasIgnition = rows.some((r) => r.ignition !== null);
  const trips: ExtractedTrip[] = [];
  let idleDropped = 0;

  // group by vehicle (preserving time order)
  const groups = new Map<string, ParsedGpsRow[]>();
  for (const r of rows) {
    if (!groups.has(r.vehicle)) groups.set(r.vehicle, []);
    groups.get(r.vehicle)!.push(r);
  }

  for (const [vehicle, vrows] of groups) {
    if (hasIgnition) {
      let current: ParsedGpsRow[] = [];
      const flush = () => {
        if (current.length === 0) return;
        const t = finalizeTrip(vehicle, current);
        if (t) {
          // drop ignition flicker noise: < 0.1 km and < 2 minutes
          if (t.distanceKm < 0.1 && t.durationMin < 2) idleDropped++;
          else trips.push(t);
        }
        current = [];
      };
      for (const r of vrows) {
        if (r.ignition === true) {
          if (current.length === 0) current = [r]; // fresh trip start
          else current.push(r); // already in a trip, keep sampling
        } else if (r.ignition === false) {
          if (current.length > 0) { current.push(r); flush(); }
        } else {
          if (current.length > 0) current.push(r);
        }
      }
      flush(); // file ended while ignition ON
    } else {
      // No ignition column: fall back to one trip per vehicle per calendar day
      const byDay = new Map<string, ParsedGpsRow[]>();
      for (const r of vrows) {
        const key = `${r.ts.getUTCFullYear()}-${r.ts.getUTCMonth()}-${r.ts.getUTCDate()}`;
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(r);
      }
      for (const dayRows of byDay.values()) {
        const t = finalizeTrip(vehicle, dayRows);
        if (t && (t.distanceKm >= 0.1 || t.durationMin >= 2)) trips.push(t);
      }
    }
  }

  trips.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  return { trips, idleDropped, ignitionMode: hasIgnition ? "ignition" : "fallback-daily" };
}

/* ------------------------------------------------------------------ */
/*  Public entry point                                                 */
/* ------------------------------------------------------------------ */

export function processCsv(text: string, fileName: string): CsvParseResult {
  const { rows: rawRows, headers } = parseCsvRows(text);
  const detected = detectColumns(headers);
  const report: ParseReport = {
    fileName,
    totalRows: rawRows.length,
    usedRows: 0,
    skippedRows: 0,
    idleDropped: 0,
    vehicles: [],
    vehicleCounts: {},
    detected,
    ignitionMode: "ignition",
    warnings: [],
  };

  if (!detected.timestamp) {
    report.warnings.push("No timestamp column detected — rows were skipped. Expected a column like 'Timestamp', 'Date Time', 'GPS Time'.");
  }
  if (!detected.odometer) {
    report.warnings.push("No odometer column found — trip distance will be estimated from GPS coordinates (haversine).");
  }
  if (!detected.ignition) {
    report.warnings.push("No ignition column found — trips are grouped as one per vehicle per calendar day.");
  }
  if (!detected.location) {
    report.warnings.push("No location column found — start/end points will be shown as GPS coordinates.");
  }

  if (rawRows.length === 0 || !detected.timestamp) {
    return { trips: [], report };
  }

  const { rows, skipped } = normalizeRows(rawRows, detected);
  report.skippedRows = skipped;
  report.usedRows = rows.length;

  const { trips, idleDropped, ignitionMode } = extractTrips(rows);
  report.idleDropped = idleDropped;
  report.ignitionMode = ignitionMode;

  const counts: Record<string, number> = {};
  for (const t of trips) counts[t.vehicleName] = (counts[t.vehicleName] || 0) + 1;
  report.vehicleCounts = counts;
  report.vehicles = Object.keys(counts);

  return { trips, report };
}
