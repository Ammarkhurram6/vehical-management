"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UploadCloud, FileSpreadsheet, Trash2, Route, Navigation, Gauge, Clock3,
  CalendarDays, AlertTriangle, CheckCircle2, Loader2, Download,
} from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { TripDTO } from "@/lib/fleet-types";
import { fmtNum, fmtDate, fmtTime, fmtDuration, currentMonthKey, fmtMonth } from "@/lib/format";
import { StatCard, SectionCard, ChartTooltip, VehicleBadge, EmptyState, api, stagger } from "./ui-bits";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- */

interface UploadReport {
  created: number;
  report: {
    fileName: string; totalRows: number; usedRows: number; skippedRows: number; idleDropped: number;
    vehicleCounts: Record<string, number>; warnings: string[]; ignitionMode: string;
  };
}

interface TripsResponse {
  trips: TripDTO[];
  meta: { count: number; totalKm: number; totalMinutes: number; avgKm: number; vehicles: string[] };
}

interface SummaryResponse {
  granularity: string;
  summary: { period: string; trips: number; km: number; minutes: number; vehicles: number }[];
}

export default function TripsView({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [month, setMonth] = useState(""); // set after mount — avoids SSR (UTC) vs client (PKT) month-boundary mismatch
  const [vehicle, setVehicle] = useState("all");
  const [granularity, setGranularity] = useState("daily");
  const [data, setData] = useState<TripsResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [report, setReport] = useState<UploadReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({ month: month || currentMonthKey(), vehicle });
    return p.toString();
  }, [month, vehicle]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        api<TripsResponse>(`/api/trips?${query}`),
        api<SummaryResponse>(`/api/trips/summary?${query}&granularity=${granularity}`),
      ]);
      setData(d);
      setSummary(s);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, granularity]);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => { setMonth(currentMonthKey()); }, []);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setReport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api<UploadReport>("/api/trips/upload", { method: "POST", body: form });
      setReport(res);
      toast.success(`${res.created} trip${res.created === 1 ? "" : "s"} extracted from ${res.report.fileName}`);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearAll = async () => {
    try {
      await api("/api/trips", { method: "DELETE" });
      toast.success("All trip records cleared");
      setReport(null);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const meta = data?.meta;

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <motion.div {...stagger(0)} className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div
            role="button" tabIndex={0} aria-label="Upload GPS tracking CSV"
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) uploadFile(f); }}
            className={cn(
              "group flex h-full min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-6 py-8 text-center shadow-sm transition-all",
              dragOver ? "border-emerald-500 bg-emerald-50/70 scale-[1.01]" : "border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/30"
            )}
          >
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 transition-transform group-hover:scale-105">
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
            </span>
            <p className="mt-4 text-[15px] font-semibold text-slate-800">
              {uploading ? "Parsing GPS data…" : "Drop your tracking CSV here"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Timestamp, Lat/Long, Location, Ignition (ON/OFF), Speed, Total Odometer, Vehicle
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs pointer-events-none">
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Choose file
              </Button>
              <a href="/sample-trips.csv" download onClick={(e) => e.stopPropagation()}
                className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Sample CSV
              </a>
            </div>
          </div>
        </div>

        {/* Parse report / info */}
        <div className="lg:col-span-2">
          {report ? (
            <div className="h-full rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-semibold text-emerald-800">
                  {report.created} trips created
                </h3>
              </div>
              <p className="mt-1.5 text-xs text-emerald-700/80">
                {report.report.usedRows} GPS rows • {report.report.skippedRows} skipped
                {report.report.idleDropped > 0 && ` • ${report.report.idleDropped} idle flickers ignored`}
                {" • "}{report.report.ignitionMode === "ignition" ? "ignition-based grouping" : "daily fallback grouping"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(report.report.vehicleCounts).map(([v, c]) => (
                  <span key={v} className="rounded-md bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                    {v} · {c} trips
                  </span>
                ))}
              </div>
              {report.report.warnings.length > 0 && (
                <div className="mt-3 space-y-1.5 rounded-xl bg-amber-50/90 p-3">
                  {report.report.warnings.map((w, i) => (
                    <p key={i} className="flex gap-1.5 text-[11px] leading-4 text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CalendarDays className="h-4 w-4 text-emerald-600" /> How trips are detected
              </h3>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-500">
                <li className="flex gap-2"><span className="font-bold text-emerald-600">1.</span> Rows are sorted per vehicle by timestamp.</li>
                <li className="flex gap-2"><span className="font-bold text-emerald-600">2.</span> <span><b>Ignition ON</b> starts a trip; <b>OFF</b> closes it — Point A → Point B.</span></li>
                <li className="flex gap-2"><span className="font-bold text-emerald-600">3.</span> Distance = odometer end − start (GPS fallback if missing).</li>
                <li className="flex gap-2"><span className="font-bold text-emerald-600">4.</span> Sub-0.1 km ignition flickers are ignored automatically.</li>
              </ul>
            </div>
          )}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div {...stagger(1)} className="flex flex-wrap items-center gap-3">
        <input
          type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonthKey())}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        <Select value={vehicle} onValueChange={setVehicle}>
          <SelectTrigger className="h-9 w-[220px] bg-white text-sm shadow-sm"><SelectValue placeholder="All vehicles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vehicles</SelectItem>
            {(meta?.vehicles || []).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Tabs value={granularity} onValueChange={setGranularity}>
          <TabsList className="h-9 bg-slate-100">
            {["daily", "weekly", "monthly"].map((g) => (
              <TabsTrigger key={g} value={g} className="h-7 px-3 text-xs capitalize data-[state=active]:bg-white data-[state=active]:text-emerald-700">{g}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="ms-auto">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear all trips
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all trip records?</AlertDialogTitle>
                <AlertDialogDescription>This permanently removes every trip extracted from CSVs. Financial entries and the manager ledger are not affected.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearAll} className="bg-rose-600 hover:bg-rose-700">Delete all</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </motion.div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={month === "" ? "All-time Distance" : "Distance this period"} value={fmtNum(meta?.totalKm || 0)} sub="kilometers" icon={Route} iconClass="bg-emerald-100 text-emerald-600" delay={1} />
        <StatCard label="Trips" value={String(meta?.count || 0)} sub="in selected filters" icon={Navigation} iconClass="bg-teal-100 text-teal-600" delay={2} />
        <StatCard label="Avg Distance / Trip" value={fmtNum(meta?.avgKm || 0)} sub="kilometers" icon={Gauge} iconClass="bg-amber-100 text-amber-600" delay={3} />
        <StatCard label="Time on Road" value={fmtDuration(meta?.totalMinutes || 0)} sub="total driving time" icon={Clock3} iconClass="bg-violet-100 text-violet-600" delay={4} />
      </div>

      {/* Period chart */}
      <SectionCard
        title={`${granularity[0].toUpperCase()}${granularity.slice(1)} summary`}
        subtitle={month ? `Trips & kilometers — ${fmtMonth(month)}` : "Trips & kilometers"}
        delay={5}
      >
        {summary && summary.summary.length > 0 ? (
          <div className="h-[220px] w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.summary.map((s) => ({
                ...s,
                label: granularity === "daily" ? s.period.slice(8)
                  : granularity === "weekly" ? "W" + s.period.slice(8)
                  : s.period.slice(5),
              }))} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<ChartTooltip formatter={(v, key) => key === "km" ? fmtNum(v) + " km" : String(v)} />} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="km" name="Distance (km)" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">No trips in the selected period</p>
        )}
      </SectionCard>

      {/* Trips table */}
      <SectionCard title="Daily Trip Log" subtitle={meta ? `${meta.count} trips • ${fmtNum(meta.totalKm)} km` : "Loading…"} delay={6}>
        {!loading && (data?.trips.length ?? 0) === 0 ? (
          <EmptyState icon={Route} title="No trips found" description="Upload a GPS tracking CSV for this month/vehicle, or adjust the filters above." />
        ) : (
          <div className="max-h-[540px] overflow-auto rounded-xl border border-slate-100 [&_td]:px-3 [&_th]:px-3">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-slate-500">Date</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Vehicle</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Route</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Start</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">End</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Duration</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-500">Distance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.trips || []).map((t) => (
                  <TableRow key={t.id} className="hover:bg-emerald-50/30">
                    <TableCell className="whitespace-nowrap text-[13px] font-medium text-slate-700">{fmtDate(t.tripDate)}</TableCell>
                    <TableCell><VehicleBadge name={t.vehicleName} /></TableCell>
                    <TableCell className="max-w-[260px]">
                      <div className="flex items-center gap-1.5 text-[13px]" title={`${t.startLocation} → ${t.endLocation}`}>
                        <span className="max-w-[115px] truncate text-slate-700">{t.startLocation}</span>
                        <span className="text-emerald-500">→</span>
                        <span className="max-w-[115px] truncate text-slate-700">{t.endLocation}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[13px] tabular-nums text-slate-600">{fmtTime(t.startTime)}</TableCell>
                    <TableCell className="whitespace-nowrap text-[13px] tabular-nums text-slate-600">{fmtTime(t.endTime)}</TableCell>
                    <TableCell className="whitespace-nowrap text-[13px] tabular-nums text-slate-500">{fmtDuration(t.durationMin)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right text-[13px] font-bold tabular-nums text-emerald-700">{fmtNum(t.distanceKm)} km</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
