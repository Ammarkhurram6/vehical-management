"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, HandCoins, FilePlus2, Loader2, Trash2, ArrowDownToLine, ArrowUpFromLine, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MANAGER_NAME, type LedgerEntryDTO } from "@/lib/fleet-types";
import { fmtPKR, fmtDate, todayKey } from "@/lib/format";
import { SectionCard, EmptyState, api, stagger } from "./ui-bits";
import { cn } from "@/lib/utils";

interface LedgerResponse {
  entries: LedgerEntryDTO[];
  totals: { balance: number; credited: number; paid: number; lastPaymentAt: string | null };
}

export default function LedgerView({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [entryType, setEntryType] = useState<"PAYMENT" | "CREDIT">("PAYMENT");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayKey());
  const [desc, setDesc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<LedgerResponse>("/api/ledger"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (!/^\d{4}-\d{2}-\d{2}/.test(date)) { toast.error("Pick a valid date"); return; }
    setSaving(true);
    try {
      await api("/api/ledger", {
        method: "POST",
        body: JSON.stringify({ type: entryType, amount: amt, entryDate: date, description: desc }),
      });
      toast.success(
        entryType === "PAYMENT"
          ? `Payment of ${fmtPKR(amt)} cleared from ${MANAGER_NAME}'s dues`
          : `Credit of ${fmtPKR(amt)} added to ${MANAGER_NAME}'s dues`
      );
      setAmount(""); setDesc("");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/ledger/${id}`, { method: "DELETE" });
      toast.success("Ledger entry removed");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  /* Running balance (walk backwards from current balance) */
  const rows = useMemo(() => {
    if (!data) return [];
    let running = data.totals.balance;
    return data.entries.map((e) => {
      const after = running;
      running -= e.type === "CREDIT" ? e.amount : -e.amount;
      return { ...e, after };
    });
  }, [data]);

  const t = data?.totals;
  const clearPct = t && t.credited > 0 ? Math.min(100, Math.round((t.paid / t.credited) * 100)) : 0;

  return (
    <div className="space-y-4">
      {/* Hero: Saqib's balance */}
      <div className="grid gap-4 lg:grid-cols-5">
        <motion.div {...stagger(0)} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 shadow-md lg:col-span-3">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-6 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-xl font-bold text-white shadow-lg shadow-amber-500/25">
                {MANAGER_NAME[0]}
              </span>
              <div>
                <p className="text-[13px] font-medium text-slate-400">Vehicle Manager — Hisab Kitab</p>
                <h2 className="text-xl font-bold text-white">{MANAGER_NAME}</h2>
                <span className="mt-1 inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
                  ● LIVE BALANCE TRACKING
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-medium text-slate-400">Pending Dues</p>
              <p className={cn("text-[38px] font-bold leading-none tracking-tight tabular-nums", (t?.balance ?? 0) > 0 ? "text-amber-400" : "text-emerald-400")}>
                {fmtPKR(t?.balance || 0)}
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                {t?.lastPaymentAt ? `Last payment ${fmtDate(t.lastPaymentAt)}` : "No payments recorded yet"}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-400">Cleared {t ? fmtPKR(t.paid) : "—"} of {t ? fmtPKR(t.credited) : "—"}</span>
              <span className="font-semibold text-emerald-400">{clearPct}% settled</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                initial={{ width: 0 }} animate={{ width: `${clearPct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400"><ArrowUpFromLine className="h-3 w-3 text-amber-400" /> Total credited (dues)</p>
                <p className="mt-1 text-base font-bold text-amber-400 tabular-nums">{fmtPKR(t?.credited || 0)}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400"><ArrowDownToLine className="h-3 w-3 text-emerald-400" /> Total cleared (paid)</p>
                <p className="mt-1 text-base font-bold text-emerald-400 tabular-nums">{fmtPKR(t?.paid || 0)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick entry form */}
        <motion.div {...stagger(1)} className="min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-sm lg:col-span-2 h-fit">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
              <FilePlus2 className="h-4 w-4 text-emerald-600" /> Record Entry
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">Balance updates in real time</p>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              {(["PAYMENT", "CREDIT"] as const).map((tp) => (
                <button key={tp} onClick={() => setEntryType(tp)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold transition-all",
                    entryType === tp
                      ? tp === "PAYMENT" ? "bg-emerald-600 text-white shadow-sm" : "bg-amber-500 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}>
                  {tp === "PAYMENT" ? <HandCoins className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
                  {tp === "PAYMENT" ? "Payment" : "Add Due"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-medium text-slate-600">Amount (Rs)</Label>
                <Input type="number" min="0" placeholder="e.g. 10000" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5 h-10 text-sm" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-medium text-slate-600">Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 h-10 text-sm" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-medium text-slate-600">Note (optional)</Label>
                <Input placeholder={entryType === "PAYMENT" ? "e.g. Cash received" : "e.g. Diesel advance"} value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1.5 h-10 text-sm" />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[5000, 10000, 25000].map((q) => (
                <button key={q} onClick={() => setAmount(String(q))}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">
                  {fmtPKR(q)}
                </button>
              ))}
            </div>

            <Button onClick={submit} disabled={saving}
              className={cn("h-11 w-full text-sm font-semibold text-white shadow-sm",
                entryType === "PAYMENT" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-500 hover:bg-amber-600")}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
              {entryType === "PAYMENT" ? "Clear Payment" : "Add to Dues"}
            </Button>
          </div>
        </motion.div>
      </div>

      {/* History */}
      <SectionCard
        title="Transaction History"
        subtitle={t ? `${data?.entries.length || 0} entries • running balance shown` : "Loading…"}
        delay={2}
      >
        {rows.length === 0 ? (
          <EmptyState icon={Wallet} title="No ledger entries" description="Record credits (dues added) and payments (cleared) to build the hisab kitab history." className="border-0 bg-transparent py-10" />
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-xl border border-slate-100 [&_td]:px-3 [&_th]:px-3">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold text-slate-500">Date</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Type</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">Description</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-500">Amount</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-500">Balance After</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id} className="hover:bg-slate-50/60">
                    <TableCell className="whitespace-nowrap text-[13px] text-slate-600">{fmtDate(e.entryDate)}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold leading-5",
                        e.type === "CREDIT" ? "bg-amber-100/60 text-amber-700" : "bg-emerald-100/60 text-emerald-700"
                      )}>
                        {e.type === "CREDIT" ? <ArrowUpFromLine className="h-3 w-3" /> : <ArrowDownToLine className="h-3 w-3" />}
                        {e.type === "CREDIT" ? "Due Added" : "Payment"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="truncate text-[13px] font-medium text-slate-700" title={e.description || ""}>{e.description || "—"}</p>
                    </TableCell>
                    <TableCell className={cn("whitespace-nowrap text-right text-[13px] font-bold tabular-nums",
                      e.type === "CREDIT" ? "text-amber-600" : "text-emerald-600")}>
                      {e.type === "CREDIT" ? "+" : "−"}{fmtPKR(e.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-[13px] font-semibold tabular-nums text-slate-800">
                      {fmtPKR(e.after)}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button aria-label="Delete ledger entry" className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove this ledger entry?</AlertDialogTitle>
                            <AlertDialogDescription>The running balance will be recalculated. This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(e.id)} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
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
