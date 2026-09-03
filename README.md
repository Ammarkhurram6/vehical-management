# FleetFlow — Commercial Vehicle Fleet & Financial Management

A production-ready full-stack web application for fleet operators: parse GPS tracking CSV exports into daily trip logs, calculate trip profitability, and manage your vehicle manager's **Hisab Kitab** (ledger) — all from one modern dashboard.

![Stack](https://img.shields.io/badge/Next.js%2016-React%2019-black) ![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-4-38bdf8) ![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

---

## ✨ Features

### 1. GPS Tracking CSV Parser & Daily Route Logs
- **Drag & drop CSV upload** (or click to browse) — flexible column detection: `Timestamp`, `Latitude/Longitude`, `Location`, `Ignition Status (ON/OFF)`, `Speed`, `Total Odometer`, `Vehicle Name`. Handles variations like `Date Time`, `GPS Time`, `Odometer (km)`, `Plate No`, `Device ID`, etc.
- **Automated trip logic** (server-side, `src/lib/trip-parser.ts`):
  1. Rows are normalized and sorted per-vehicle by timestamp.
  2. **Ignition ON** opens a trip, **Ignition OFF** closes it → *Point A → Point B*.
  3. Distance = `end odometer − start odometer`; if the odometer column is missing/reset, distance falls back to **Haversine** GPS coordinate summation.
  4. Sub-0.1 km / sub-2-min ignition flickers are discarded as noise.
  5. No ignition column? Trips gracefully fall back to **one trip per vehicle per calendar day**.
- **Daily / Weekly / Monthly summary views** with km-per-period bar charts, filters (month + vehicle) and a full trip log table (route, start/end time, duration, distance).

### 2. Financial & Profit Calculation Module
- Record **Revenue** (Trip Rent, Freight, Other Income) and **Expenses** (Diesel/Fuel, Driver Pay, Traffic Challans/Fines, Toll, Maintenance, Miscellaneous) with date, vehicle and description.
- **Net profit auto-computes live** — revenue − expenses, with profit margin %, category breakdown chips and a Revenue-vs-Expenses 6-month chart.

### 3. Manager "Hisab Kitab" Ledger (Saqib)
- Dedicated ledger for vehicle manager **Saqib** with a tracked opening balance of **Rs 130,000** (seeded with demo data; fully editable).
- **Real-time balance tracking**: record *Credits* (dues added) and *Payments* (clearing) — the pending balance, settled % progress bar and running balance in history update instantly across the whole app (sidebar widget included).

### 4. Dashboard & UX
- Stat cards: **Total Fleet Distance**, **Net Profit**, **Trips Today**, **Pending Manager Dues**.
- 14-day distance trend (area chart), expense breakdown bars, recent trips feed.
- Framer Motion transitions, skeleton loaders, toast notifications, confirm dialogs, sticky footer, dark sidebar + light content theme.
- Fully responsive (desktop sidebar → mobile slide-over drawer) and keyboard accessible.

---

## 🧱 Tech Stack Mapping

| Requirement | Delivered as |
|---|---|
| React.js + Tailwind CSS frontend | **React 19** UI components (`src/components/fleet/*`) styled with **Tailwind CSS 4** + shadcn/ui, running on Next.js 16 (App Router) |
| Node.js + Express.js backend | **Node.js API routes** (`src/app/api/**/route.ts`) — same Express-style request/response handlers (Request in, JSON out), unified deploy with the frontend |
| CSV upload & processing | `POST /api/trips/upload` (multipart) → PapaParse + custom ignition/odometer trip engine |
| Database | Prisma ORM + SQLite (file: `db/custom.db`) — zero-config, production-swappable |

> Why Next.js instead of a separate Express server? You get the exact same Node.js backend (`route.ts` handlers receive a standard `Request` and return `Response`, just like Express middleware would), but with one codebase, one deploy, no CORS wiring, and shared TypeScript types between client and server. If you later need a standalone Express service, the pure logic in `src/lib/trip-parser.ts` drops in unchanged.

---

## 🚀 Setup & Run

```bash
# 1. Install dependencies
bun install        # or: npm install

# 2. Configure the database URL (.env)
echo 'DATABASE_URL=file:/home/z/my-project/db/custom.db' > .env

# 3. Push the Prisma schema
bun run db:push    # or: npx prisma db push

# 4. Start the dev server (frontend + backend on one port)
bun run dev        # or: npm run dev  →  http://localhost:3000

# 5. (Optional) Load demo data: click "Demo data" in the app header,
#    or: curl -X POST localhost:3000/api/demo -H 'Content-Type: application/json' -d '{"force":true}'
```

**Production build:** `bun run build && bun run start`

The app boots with an empty database and shows a welcome screen with a **Load demo data** button (35 days of realistic GPS trips for 3 vehicles, finance entries, and Saqib's ledger with the Rs 130,000 opening balance). Use **Reset** in the header to wipe everything anytime.

---

## 🔌 Connecting Frontend ↔ Backend

Everything is same-origin — the React client simply calls relative `/api/*` endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/trips/upload` | `POST` (multipart `file`) | Upload + parse a GPS CSV, create daily trips |
| `/api/trips?month=YYYY-MM&vehicle=` | `GET` | List trips + aggregates + vehicle list |
| `/api/trips` | `DELETE` | Clear all trips |
| `/api/trips/summary?granularity=daily\|weekly\|monthly` | `GET` | Period-aggregated km/trips/duration |
| `/api/finance?month=&type=` | `GET` | Entries + revenue/expense/net totals + category breakdown |
| `/api/finance` | `POST` | Add revenue/expense entry |
| `/api/finance/[id]` | `DELETE` | Remove an entry |
| `/api/ledger` | `GET` | Saqib's entries + balance/credited/paid totals |
| `/api/ledger` | `POST` | Record credit (due) or payment (clearing) |
| `/api/ledger/[id]` | `DELETE` | Remove a ledger entry |
| `/api/dashboard` | `GET` | All dashboard stats & chart series |
| `/api/demo` | `POST` / `DELETE` | Seed demo data / wipe all data |

**Testing the CSV parser from CLI:**

```bash
curl -X POST http://localhost:3000/api/trips/upload -F "file=@public/sample-trips.csv"
```

---

## 📄 CSV Format

A tracking export like this (download the in-app sample: `/sample-trips.csv`):

```csv
Timestamp,Latitude,Longitude,Location,Ignition Status,Speed (km/h),Total Odometer (km),Vehicle Name
2026-08-28 06:40:00,28.60206,77.30421,"Okhla Industrial Area Phase 2, New Delhi",ON,0,45230.5,DL 01 AB 1234
2026-08-28 07:05:00,28.61111,77.30123,"En route via NH-48",ON,42,45234.8,DL 01 AB 1234
2026-08-28 07:22:00,28.59875,77.28901,"IGI Airport Cargo Terminal, New Delhi",OFF,0,45264.7,DL 01 AB 1234
```

- Timestamps accept `YYYY-MM-DD HH:mm:ss`, `DD/MM/YYYY hh:mm AM/PM` (day-first preferred), ISO 8601.
- Column names are auto-detected (case/spacing/punctuation insensitive). Only **Timestamp** is mandatory; ignition, odometer, location and vehicle columns all degrade gracefully.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/                  # Node.js backend (Express-style route handlers)
│   │   ├── trips/            #   list / upload(CSV) / summary
│   │   ├── finance/[id]/     #   profit calculator CRUD
│   │   ├── ledger/[id]/      #   Saqib's hisab kitab
│   │   ├── dashboard/        #   aggregated stats
│   │   └── demo/             #   seed / reset
│   ├── layout.tsx            # Root layout + toaster
│   └── page.tsx              # Single-page app entry
├── components/fleet/         # React frontend components
│   ├── fleet-app.tsx         #   Shell: sidebar, header, view routing
│   ├── dashboard-view.tsx    #   Stat cards + charts
│   ├── trips-view.tsx        #   CSV upload + trip logs
│   ├── finance-view.tsx      #   Profit calculator
│   ├── ledger-view.tsx       #   Hisab kitab
│   └── ui-bits.tsx           #   Shared cards/badges/helpers
└── lib/
    ├── trip-parser.ts        # CSV → trips engine (pure, unit-testable)
    ├── demo-data.ts          # Realistic 35-day fleet simulator
    ├── fleet-types.ts        # Shared client/server types + category config
    ├── format.ts             # PKR/date formatters (wall-clock safe)
    └── fleet-utils.ts        # fetch helper + cn()
prisma/schema.prisma          # Trip / FinancialEntry / LedgerEntry models
public/sample-trips.csv       # Sample GPS export for testing uploads
```

## 🧮 Business Rules

- **Trip**: Ignition ON → OFF, per vehicle. Distance from odometer delta (Haversine fallback). Idle flickers (<0.1 km & <2 min) dropped.
- **Net Profit** = Σ(Revenue) − Σ(Expenses). Categories keep revenue and expense ledgers separate.
- **Pending Dues** = Σ(Credits) − Σ(Payments) in the manager ledger; the demo seed tracks Rs 130,000 as opening balance per the operator's books.
- All times render exactly as the tracking system logged them (wall-clock preserved, timezone-safe).
