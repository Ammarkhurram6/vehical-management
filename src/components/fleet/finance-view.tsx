"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Scale, Loader2, Trash2, Plus, Fuel, UserRound, Gavel, Landmark, Wrench, ReceiptIndianRupee } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FINANCE_CATEGORIES, type FinanceCategory, type FinanceEntryDTO, type FinanceType } from "@/lib/fleet-types";
import { fmtINR, fmtDate, currentMonthKey, fmtMonth, fmtINRCompact } from "@/lib/format";
import { StatCard, SectionCard, CategoryBadge, EmptyState, api, stagger } from "./ui-bits";
import { cn } from "@/lib/utils";

interface FinanceResponse {
  entries: FinanceEntryDTO[];
  totals: { revenue: number; expenses: number; net: number };
  byCategory: { category: string; amount: number }[];
  months: string[];
}

const CATEGORY_ICONS: Partial<Record<FinanceCategory, React.ElementType>> = {
  DIESEL: Fuel, DRIVER_PAY: UserRound, CHALLAN: Gavel, MAINTENANCE: Wrench, TRIP_RENT: ReceiptIndianRupee, OTHER: Landmark,
};

const CATEGORY_KEYS = Object.keys(FINANCE_CATEGORIES) as FinanceCategory[];

export default function FinanceView({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [month, setMonth] = useState(currentMonthKey());
  const [typeFilter, setTypeFilter] = useState("all");
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [fType, setFType] = useState<FinanceType>("EXPENSE");
  const [fCategory, setFCategory] = useState<FinanceCategory>("DIESEL");
  const [fAmount, setFAmount] = useState("");
  const [fDate, setFDate] = useState(currentMonthKey() + "-01");
  const [fVehicle, setFVehicle] = useState("");
  const [fDesc, setFDesc] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams({ month });
    if (typeFilter !== "all") p.set("type", typeFilter);
    return p.toString();
  }, [month, typeFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<FinanceResponse>(`/api/finance?${query}`));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const switchType = (t: FinanceType) => {
    setFType(t);
    setFCategory(t === "REVENUE" ? "TRIP_RENT" : "DIESEL");
  };

  const submit = async () => {
    const amount = parseFloat(fAmount);
    if (!isFinite(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (!/^\d{4}-\d{2}-\d{2}/.test(fDate)) { toast.error("Pick a valid date"); return; }
    setSaving(true);
    try {
      await api("/api/finance", {
        method: "POST",
        body: JSON.stringify({ type: fType, category: fCategory, amount, entryDate: fDate, vehicleName: fVehicle, description: fDesc }),
      });
      toast.success(`${FINANCE_CATEGORIES[fCategory].label} — ${fmtINR(amount)} recorded`);
      setFAmount(""); setFDesc("");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/finance/${id}`, { method: "DELETE" });
      toast.success("Entry removed");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const t = data?.totals;
  const profitPositive = (t?.net ?? 0) >= 0;
  const margin = t && t.revenue > 0 ? Math.round((t.net / t.revenue) * 100) : 0;

  const quickChips = fType === "EXPENSE" ? [1000, 2000, 5000] : [5000, 10000, 25000];

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Revenue" value={fmtINR(t?.revenue || 0)} sub="trip rent + income" icon={TrendingUp} iconClass="bg-emerald-100 text-emerald-600" valueClass="text-emerald-700" delay={0} />
        <StatCard label="Total Expenses" value={fmtINR(t?.expenses || 0)} sub="diesel + pay + challans" icon={TrendingDown} iconClass="bg-rose-100 text-rose-600" valueClass="text-rose-600" delay={1} />
        <motion.div {...stagger(2)} className={cn(
          "relative overflow-hidden rounded-2xl p-5 shadow-sm transition-all",
          profitPositive
            ? "bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-600/20"
            : "bg-gradient-to-br from-rose-600 to-red-700 shadow-rose-600/20"
        )}>
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-white/70">Net Profit / Loss</p>
              <p className="mt-1.5 text-[28px] font-bold leading-tight tracking-tight text-white tabular-nums">
                {fmtINR(t?.net || 0)}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {t && t.revenue > 0 ? `${margin >= 0 ? "+" : ""}${margin}% margin on ${fmtINRCompact(t.revenue)} revenue` : "Auto-computed: revenue − expenses"}
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
              <Scale className="h-5 w-5" />
            </span>
          </div>
        </motion.div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Add entry form */}
        <motion.div {...stagger(3)} className="min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-sm lg:col-span-2 h-fit">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-[15px] font-semibold text-slate-800">Add Entry</h3>
            <p className="mt-0.5 text-xs text-slate-400">Profit recalculates instantly</p>
          </div>
          <div className="space-y-4 p-5">
            {/* type toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              {(["REVENUE", "EXPENSE"] as FinanceType[]).map((tp) => (
                <button key={tp} onClick={() => switchType(tp)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all",
                    fType === tp
                      ? tp === "REVENUE" ? "bg-emerald-600 text-white shadow-sm" : "bg-rose-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}>
                  {tp === "REVENUE" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {tp === "REVENUE" ? "Revenue" : "Expense"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 [&>div]:min-w-0 [&_input]:min-w-0">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-medium text-slate-600">Category</Label>
                <Select value={fCategory} onValueChange={(v) => setFCategory(v as FinanceCategory)}>
                  <SelectTrigger className="mt-1.5 h-10 bg-white text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_KEYS.filter((k) => FINANCE_CATEGORIES[k].type === fType).map((k) => (
                      <SelectItem key={k} value={k}>{FINANCE_CATEGORIES[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-medium text-slate-600">Amount (₹)</Label>
                <Input type="number" min="0" placeholder="e.g. 4500" value={fAmount} onChange={(e) => setFAmount(e.target.value)}
                  className="mt-1.5 h-10 text-sm" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-medium text-slate-600">Date</Label>
                <Input type="date" value={fDate.slice(0, 10)} onChange={(e) => setFDate(e.target.value)} className="mt-1.5 h-10 text-sm" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-medium text-slate-600">Vehicle (optional)</Label>
                <Input placeholder="e.g. DL 01 AB 1234" value={fVehicle} onChange={(e) => setFVehicle(e.target.value)} className="mt-1.5 h-10 text-sm" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-medium text-slate-600">Description (optional)</Label>
                <Input placeholder="e.g. Diesel top-up at Ajit Filling Station" value={fDesc} onChange={(e) => setFDesc(e.target.value)}
                  className="mt-1.5 h-10 text-sm" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {quickChips.map((q) => (
                <button key={q} onClick={() => setFAmount(String(q))}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">
                  {fmtINRCompact(q)}
                </button>
              ))}
            </div>

            <Button onClick={submit} disabled={saving}
              className={cn("h-11 w-full text-sm font-semibold text-white shadow-sm", fType === "REVENUE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700")}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {fType === "REVENUE" ? "Add Revenue" : "Add Expense"}
            </Button>
          </div>
        </motion.div>

        {/* Entries */}
        <motion.div {...stagger(4)} className="lg:col-span-3">
          <SectionCard
            title="Ledger of Entries"
            subtitle={month ? fmtMonth(month) : "All time"}
            delay={4}
            action={
              <div className="flex items-center gap-2">
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonthKey())}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none focus:border-emerald-500" />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-8 w-[110px] bg-white text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="REVENUE">Revenue</SelectItem>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          >
            {/* category chips */}
            {data && data.byCategory.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {data.byCategory.map((c) => (
                  <span key={c.category} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/70">
                    <CategoryBadge category={c.category} />
                    <b className="tabular-nums">{fmtINRCompact(c.amount)}</b>
                  </span>
                ))}
              </div>
            )}

            {data && data.entries.length === 0 ? (
              <EmptyState icon={Scale} title="No entries yet" description="Record trip rent, diesel, driver pay, challans and other expenses to see the net profit here." className="border-0 bg-transparent py-10" />
            ) : (
              <div className="max-h-[480px] overflow-auto rounded-xl border border-slate-100 [&_td]:px-2.5 [&_th]:px-2.5">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold text-slate-500">Date</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Category</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Details</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-slate-500">Amount</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.entries || []).map((e) => {
                      const Icon = CATEGORY_ICONS[e.category] || Landmark;
                      return (
                        <TableRow key={e.id} className="hover:bg-slate-50/60">
                          <TableCell className="whitespace-nowrap text-[13px] text-slate-600">{fmtDate(e.entryDate)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CategoryBadge category={e.category} />
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[150px]">
                            <p className="truncate text-[13px] font-medium text-slate-700" title={`${e.vehicleName ? e.vehicleName + " — " : ""}${e.description || ""}`}>
                              <Icon className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                              {e.description || "—"}
                            </p>
                            {e.vehicleName && <p className="mt-0.5 max-w-[150px] truncate text-[11px] text-slate-400">{e.vehicleName}</p>}
                          </TableCell>
                          <TableCell className={cn("whitespace-nowrap text-right text-[13px] font-bold tabular-nums",
                            e.type === "REVENUE" ? "text-emerald-600" : "text-rose-600")}>
                            {e.type === "REVENUE" ? "+" : "−"}{fmtINR(e.amount)}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button aria-label="Delete entry" className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove this entry?</AlertDialogTitle>
                                  <AlertDialogDescription>{FINANCE_CATEGORIES[e.category]?.label} — {fmtINR(e.amount)}. This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => remove(e.id)} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        </motion.div>
      </div>
    </div>
  );
}
