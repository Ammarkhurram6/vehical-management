"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Truck, LayoutDashboard, Route as RouteIcon, Calculator, BookOpenText,
  RefreshCw, Menu, Sparkles, RotateCcw, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { fmtPKR, fmtPKRCompact } from "@/lib/format";
import type { DashboardData } from "@/lib/fleet-types";
import { api, cn } from "@/lib/fleet-utils";
import DashboardView from "./dashboard-view";
import TripsView from "./trips-view";
import FinanceView from "./finance-view";
import LedgerView from "./ledger-view";

type View = "dashboard" | "trips" | "finance" | "ledger";

const NAV: { view: View; label: string; icon: React.ElementType; section: string }[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { view: "trips", label: "Trip Logs", icon: RouteIcon, section: "Operations" },
  { view: "finance", label: "Profit Calculator", icon: Calculator, section: "Finance" },
  { view: "ledger", label: "Manager Ledger", icon: BookOpenText, section: "Finance" },
];

const TITLES: Record<View, { title: string; sub: string }> = {
  dashboard: { title: "Fleet Overview", sub: "Distances, profit and dues at a glance" },
  trips: { title: "Trip Logs", sub: "Upload GPS CSVs — daily routes, Point A to B" },
  finance: { title: "Profit Calculator", sub: "Revenue vs expenses — net profit auto-computed" },
  ledger: { title: "Hisab Kitab — Saqib", sub: "Pending dues, credits and payment clearing" },
};

export default function FleetApp() {
  const [view, setView] = useState<View>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [today, setToday] = useState("");

  const onChanged = useCallback(() => setRefreshKey((k) => k + 1), []);

  const loadDash = useCallback(async () => {
    try {
      setDash(await api<DashboardData>("/api/dashboard"));
    } catch { /* sidebar chip fails silently */ }
  }, []);

  useEffect(() => {
    loadDash();
    setToday(new Date().toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric" }));
  }, [loadDash, refreshKey]);

  const seedDemo = async () => {
    setBusy(true);
    try {
      await api("/api/demo", {
        method: "POST",
        body: JSON.stringify({ force: true, tzOffsetMinutes: new Date().getTimezoneOffset() }),
      });
      toast.success("Demo fleet data loaded");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resetAll = async () => {
    setBusy(true);
    try {
      await api("/api/demo", { method: "DELETE" });
      toast.success("All data cleared — fresh start");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const navigate = (v: View) => { setView(v); setMobileNav(false); };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-1" aria-label="Main navigation">
      {NAV.map(({ view: v, label, icon: Icon, section }) => {
        const showSection = NAV.find((n) => n.section === section) === NAV.find((n) => n.view === v);
        return (
          <div key={v}>
            {showSection && (
              <p className="px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">{section}</p>
            )}
            <button
              onClick={() => { navigate(v); onNavigate?.(); }}
              aria-current={view === v ? "page" : undefined}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                view === v
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              {view === v && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400" />}
              <Icon className={cn("h-[18px] w-[18px] shrink-0", view === v ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300")} />
              {label}
            </button>
          </div>
        );
      })}
    </nav>
  );

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-2 pt-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
          <Truck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[17px] font-bold leading-tight text-white">FleetFlow</p>
          <p className="text-[11px] text-slate-500">Fleet & Hisab Kitab</p>
        </div>
      </div>

      <div className="px-3 pb-2 pt-2">
        <NavLinks onNavigate={onNavigate} />
      </div>

      <div className="mt-auto p-4">
        <button
          onClick={() => { navigate("ledger"); onNavigate?.(); }}
          className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            Pending — Saqib
          </p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-amber-400">
            {dash ? fmtPKR(dash.totals.pendingDues) : "…"}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">View hisab kitab →</p>
        </button>
        <p className="px-1 pt-3 text-[10px] text-slate-600">FleetFlow v1.0 — local data, private</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6f5]">
      {/* decorative background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-emerald-200/25 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-teal-100/40 blur-[100px]" />
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] bg-[#0a1310] lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile nav overlay */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
          <motion.aside
            initial={{ x: -280 }} animate={{ x: 0 }} transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="absolute inset-y-0 left-0 w-[280px] bg-[#0a1310] shadow-2xl"
          >
            <button onClick={() => setMobileNav(false)} aria-label="Close menu"
              className="absolute right-3 top-4 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileNav(false)} />
          </motion.aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-h-screen flex-col lg:pl-[268px]">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-3 px-4 md:px-8">
            <button onClick={() => setMobileNav(true)} aria-label="Open menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[17px] font-bold text-slate-900">{TITLES[view].title}</h1>
              <p className="hidden truncate text-xs text-slate-400 sm:block">{TITLES[view].sub}</p>
            </div>
            {today && (
              <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm md:block">
                {today}
              </span>
            )}
            <Button variant="outline" size="icon" aria-label="Refresh data" onClick={onChanged}
              className="h-9 w-9 border-slate-200 text-slate-500 hover:text-emerald-600">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={seedDemo} disabled={busy} size="sm"
              className="hidden h-9 bg-emerald-600 text-white hover:bg-emerald-700 sm:inline-flex">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Demo data
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy}
                  className="h-9 border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset all data?</AlertDialogTitle>
                  <AlertDialogDescription>Trips, financial entries and {`Saqib's`} ledger will be permanently deleted. You can reload the demo data afterwards.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resetAll} className="bg-rose-600 hover:bg-rose-700">Reset everything</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-[1160px] flex-1 px-4 py-6 md:px-8">
          {view === "dashboard" && <DashboardView refreshKey={refreshKey} onNavigate={navigate} onChanged={onChanged} />}
          {view === "trips" && <TripsView refreshKey={refreshKey} onChanged={onChanged} />}
          {view === "finance" && <FinanceView refreshKey={refreshKey} onChanged={onChanged} />}
          {view === "ledger" && <LedgerView refreshKey={refreshKey} onChanged={onChanged} />}
        </main>

        {/* Sticky footer */}
        <footer className="mt-auto border-t border-slate-200/70 bg-white/60">
          <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-slate-400 md:px-8">
            <p>FleetFlow — commercial vehicle fleet & financial management</p>
            {dash && (
              <p className="tabular-nums">
                {dash.totals.trips} trips • {dash.totals.distanceKm.toLocaleString("en-PK", { maximumFractionDigits: 0 })} km • Net {fmtPKRCompact(dash.totals.netProfit)}
              </p>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
