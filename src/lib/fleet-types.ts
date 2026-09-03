/* Shared DTO types between API routes and client components.
   All Date fields are serialized to ISO strings over JSON. */

export interface TripDTO {
  id: string;
  vehicleName: string;
  tripDate: string;
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  distanceKm: number;
  maxSpeed: number;
  avgSpeed: number;
  durationMin: number;
}

export type FinanceType = "REVENUE" | "EXPENSE";
export type FinanceCategory =
  | "TRIP_RENT" | "FREIGHT" | "OTHER_INCOME"
  | "DIESEL" | "DRIVER_PAY" | "CHALLAN" | "TOLL" | "MAINTENANCE" | "OTHER";

export interface FinanceEntryDTO {
  id: string;
  type: FinanceType;
  category: FinanceCategory;
  amount: number;
  description: string | null;
  vehicleName: string | null;
  entryDate: string;
}

export type LedgerType = "CREDIT" | "PAYMENT";

export interface LedgerEntryDTO {
  id: string;
  type: LedgerType;
  amount: number;
  description: string | null;
  entryDate: string;
}

export interface FinanceTotals {
  revenue: number;
  expenses: number;
  net: number;
}

export interface CategoryTotal {
  category: string;
  type: FinanceType;
  amount: number;
}

export interface DashboardData {
  totals: {
    distanceKm: number;
    trips: number;
    revenue: number;
    expenses: number;
    netProfit: number;
    pendingDues: number;
    ledgerCredited: number;
    ledgerPaid: number;
  };
  tripsToday: number;
  vehiclesToday: number;
  distance14d: { date: string; km: number; trips: number }[];
  monthly: { month: string; revenue: number; expenses: number }[];
  expenseBreakdown: { category: string; amount: number }[];
  recentTrips: TripDTO[];
  isEmpty: boolean;
}

/* Category metadata (labels + colors) shared by client + seed */

export const FINANCE_CATEGORIES: Record<
  FinanceCategory,
  { label: string; type: FinanceType; color: string }
> = {
  TRIP_RENT: { label: "Trip Rent", type: "REVENUE", color: "#10b981" },
  FREIGHT: { label: "Freight Charges", type: "REVENUE", color: "#14b8a6" },
  OTHER_INCOME: { label: "Other Income", type: "REVENUE", color: "#84cc16" },
  DIESEL: { label: "Diesel / Fuel", type: "EXPENSE", color: "#f59e0b" },
  DRIVER_PAY: { label: "Driver Pay", type: "EXPENSE", color: "#f97316" },
  CHALLAN: { label: "Traffic Challan / Fine", type: "EXPENSE", color: "#ef4444" },
  TOLL: { label: "Toll / State Tax", type: "EXPENSE", color: "#a855f7" },
  MAINTENANCE: { label: "Maintenance / Repair", type: "EXPENSE", color: "#8b5cf6" },
  OTHER: { label: "Miscellaneous", type: "EXPENSE", color: "#64748b" },
};

export const MANAGER_NAME = "Saqib";
export const OPENING_BALANCE = 130000;
