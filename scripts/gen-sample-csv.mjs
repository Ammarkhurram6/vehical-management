/* Generates a realistic sample GPS tracking CSV into public/sample-trips.csv
   for users to test the upload flow. Run: node scripts/gen-sample-csv.mjs */
import { writeFileSync, mkdirSync } from "fs";

const pad = (n) => (n < 10 ? `0${n}` : String(n));
const fmt = (d) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

const routes = [
  { vehicle: "DL 01 AB 1234", from: "Okhla Industrial Area Phase 2, New Delhi", to: "IGI Airport Cargo Terminal, New Delhi", km: 34.2, startHour: 6, startMin: 40 },
  { vehicle: "DL 01 AB 1234", from: "IGI Airport Cargo Terminal, New Delhi", to: "Connaught Place, New Delhi", km: 21.8, startHour: 10, startMin: 15 },
  { vehicle: "DL 01 AB 1234", from: "Connaught Place, New Delhi", to: "Azadpur Mandi, New Delhi", km: 14.6, startHour: 16, startMin: 5 },
  { vehicle: "HR 26 DK 8890", from: "Gurugram Sector 32, Haryana", to: "Noida Sector 62, UP", km: 52.4, startHour: 7, startMin: 25 },
  { vehicle: "HR 26 DK 8890", from: "Noida Sector 62, UP", to: "Gurugram Sector 32, Haryana", km: 49.9, startHour: 15, startMin: 50 },
];

let odo = 45230.5;
let cursor = Date.UTC(2026, 7, 28, 0, 0, 0); // 2026-08-28 base day (day1)
const lines = ["Timestamp,Latitude,Longitude,Location,Ignition Status,Speed (km/h),Total Odometer (km),Vehicle Name"];

let dayOffset = 0;
let prevVehicle = null;
for (const r of routes) {
  if (prevVehicle && prevVehicle !== r.vehicle) { dayOffset++; odo += 3.7; }
  prevVehicle = r.vehicle;
  const start = cursor + dayOffset * 86400000 + r.startHour * 3600000 + r.startMin * 60000;
  const driveMin = Math.round((r.km / 38) * 60);
  const pings = Math.max(3, Math.floor(driveMin / 7));

  lines.push(`${fmt(new Date(start))},${(28.54 + Math.random() * 0.2).toFixed(5)},${(77.2 + Math.random() * 0.2).toFixed(5)},"${r.from}",ON,0,${odo.toFixed(1)},${r.vehicle}`);
  for (let p = 1; p <= pings; p++) {
    const t = start + (driveMin / (pings + 1)) * p * 60000;
    odo += r.km / (pings + 1);
    lines.push(`${fmt(new Date(t))},${(28.54 + Math.random() * 0.25).toFixed(5)},${(77.2 + Math.random() * 0.25).toFixed(5)},"En route via NH-48",ON,${Math.round(26 + Math.random() * 34)},${odo.toFixed(1)},${r.vehicle}`);
  }
  odo += r.km / (pings + 1);
  const end = start + driveMin * 60000;
  lines.push(`${fmt(new Date(end))},${(28.54 + Math.random() * 0.2).toFixed(5)},${(77.2 + Math.random() * 0.2).toFixed(5)},"${r.to}",OFF,0,${odo.toFixed(1)},${r.vehicle}`);
}

mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/sample-trips.csv", import.meta.url), lines.join("\n") + "\n");
console.log(`Wrote ${lines.length - 1} GPS rows (${lines.filter(l => ",ON,".includes("") && l.includes(",ON,")).length} ON markers) to public/sample-trips.csv`);
