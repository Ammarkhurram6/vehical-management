"use client";

/* Quick Calculator — full manual calculator for adding up values by hand.
   Supports + − × ÷ % ± AC ⌫ memory keys (MC/MR/M+/M−), a clickable history
   tape, keyboard input, and a one-tap "Use as Amount" push into a form. */

import { useState } from "react";
import { Calculator as CalculatorIcon, Delete, MousePointerClick, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtPKR } from "@/lib/format";
import { toast } from "sonner";

type Op = "+" | "-" | "×" | "÷";

interface HistoryItem {
  expr: string;
  value: number;
}

const MAX_DIGITS = 12;

function fold(a: number, b: number, op: Op): number {
  let r: number;
  switch (op) {
    case "+": r = a + b; break;
    case "-": r = a - b; break;
    case "×": r = a * b; break;
    case "÷": r = b === 0 ? NaN : a / b; break;
  }
  if (!isFinite(r)) return NaN;
  return parseFloat(r.toPrecision(12));
}

/** "12345.6" -> "12,345.6" (keeps typed decimals, handles sign & exponent) */
function group(raw: string): string {
  if (!raw || raw === "-") return "0";
  if (/e/i.test(raw)) return Number(raw).toLocaleString("en-PK", { maximumFractionDigits: 6 });
  const neg = raw.startsWith("-");
  const body = neg ? raw.slice(1) : raw;
  const [int, dec] = body.split(".");
  const g = (int || "0").replace(/^0+(?=\d)/, "");
  return `${neg ? "-" : ""}${Number(g || 0).toLocaleString("en-PK")}${dec !== undefined ? "." + dec : ""}`;
}

const DIGIT_CLS = "border border-slate-200 bg-white text-slate-800 hover:bg-slate-100";
const OP_IDLE = "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200";
const OP_ACTIVE = "bg-slate-800 text-white shadow-sm hover:bg-slate-900";
const FN_CLS = "border border-slate-200 bg-white text-slate-500 hover:bg-slate-100";

/** Whole numbers show no decimals; fractions keep 2 decimals */
function fmtAmt(v: number): string {
  return fmtPKR(v, Number.isInteger(v) ? 0 : 2);
}

export default function QuickCalculator({ onUse, className }: {
  onUse?: (value: number) => void;
  className?: string;
}) {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [wait, setWait] = useState(false); // next digit replaces the display
  const [expr, setExpr] = useState("");
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cur = () => {
    const v = parseFloat(display);
    return isFinite(v) ? v : 0;
  };

  const reset = () => {
    setDisplay("0"); setAcc(null); setOp(null); setWait(false); setExpr(""); setError(null);
  };

  const inputDigit = (d: string) => {
    if (error) return;
    if (wait) {
      setDisplay(d);
      setWait(false);
      setExpr(acc !== null && op ? `${group(String(acc))} ${op}` : "");
      return;
    }
    setDisplay((prev) => {
      if (prev === "0") return d;
      if (prev.replace(/[-.]/g, "").length >= MAX_DIGITS) return prev;
      return prev + d;
    });
  };

  const inputDot = () => {
    if (error) return;
    if (wait) { setDisplay("0."); setWait(false); return; }
    setDisplay((prev) => (prev.includes(".") ? prev : prev + "."));
  };

  const backspace = () => {
    if (error || wait) return;
    setDisplay((prev) => {
      if (prev.length <= 1) return "0";
      if (prev.length === 2 && prev.startsWith("-")) return "0";
      return prev.slice(0, -1);
    });
  };

  const toggleSign = () => {
    if (error) return;
    setDisplay((prev) => {
      const v = parseFloat(prev);
      if (!isFinite(v) || v === 0) return prev;
      return prev.startsWith("-") ? prev.slice(1) : `-${prev}`;
    });
  };

  const percent = () => {
    if (error) return;
    const v = cur();
    // 200 + 10 %  -> 10% of 200 = 20 ; 50 % alone -> 0.5
    const r = acc !== null && (op === "+" || op === "-") ? (acc * v) / 100 : v / 100;
    if (!isFinite(r)) return;
    setDisplay(String(parseFloat(r.toPrecision(12))));
    setWait(true);
  };

  const chooseOp = (next: Op) => {
    if (error) return;
    const v = cur();
    let base: number;
    if (acc !== null && op !== null) {
      base = wait ? acc : fold(acc, v, op); // operator swap vs. chained calculation
      if (isNaN(base)) { setError("Can't divide by 0"); return; }
    } else {
      base = v;
    }
    setAcc(base);
    setDisplay(String(base));
    setOp(next);
    setWait(true);
    setExpr(`${group(String(base))} ${next}`);
  };

  const equals = () => {
    if (error || acc === null || op === null) return;
    const b = cur();
    const r = fold(acc, b, op);
    if (isNaN(r)) { setError("Can't divide by 0"); return; }
    const line = `${group(String(acc))} ${op} ${group(String(b))}`;
    setHistory((h) => [{ expr: line, value: r }, ...h].slice(0, 5));
    setExpr(`${line} =`);
    setDisplay(String(r));
    setAcc(null); setOp(null); setWait(true);
  };

  /* memory keys */
  const guarded = (fn: () => void) => () => { if (!error) fn(); };
  const memAdd = guarded(() => setMemory((m) => m + cur()));
  const memSub = guarded(() => setMemory((m) => m - cur()));
  const memRecall = guarded(() => { setDisplay(String(memory)); setWait(true); });
  const memClear = guarded(() => setMemory(0));

  /* keyboard support (only while focus is inside the calculator) */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const onButton = (e.target as HTMLElement).tagName === "BUTTON";
    if (onButton && (e.key === "Enter" || e.key === " ")) return; // let the button fire its own click
    const map: [string[], () => void][] = [
      [["Enter", "="], equals],
      [["."], inputDot],
      [["+"], () => chooseOp("+")],
      [["-"], () => chooseOp("-")],
      [["*"], () => chooseOp("×")],
      [["/"], () => chooseOp("÷")],
      [["%"], percent],
      [["Backspace"], backspace],
      [["Escape"], reset],
    ];
    for (const [keys, fn] of map) {
      if (keys.includes(e.key)) { e.preventDefault(); fn(); return; }
    }
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); inputDigit(e.key); }
  };

  const useAsAmount = () => {
    if (error) { toast.error(error); return; }
    onUse?.(parseFloat(cur().toPrecision(10)));
  };

  const BTN = "flex h-11 items-center justify-center rounded-xl text-[15px] font-semibold transition-all select-none active:scale-95";

  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Quick calculator"
      className={cn(
        "h-fit overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
        className
      )}
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-white">
            <CalculatorIcon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-800">Quick Calculator</h3>
            <p className="text-xs text-slate-400">Add up values by hand, then push the total</p>
          </div>
        </div>
        {memory !== 0 && (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">M</span>
        )}
      </div>

      <div className="space-y-3 p-5">
        {/* display */}
        <div className="rounded-xl bg-slate-900 px-4 py-3 text-right shadow-inner">
          <p className="h-4 truncate text-[11px] font-medium text-slate-400">{expr || "\u00A0"}</p>
          <p className={cn(
            "mt-0.5 truncate text-[26px] font-bold leading-tight tracking-tight text-white tabular-nums",
            error && "text-base text-rose-400"
          )}>
            {error ?? group(display)}
          </p>
        </div>

        {/* history tape */}
        {history.length > 0 && (
          <div className="max-h-[92px] space-y-0.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-2">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => { if (error) return; setDisplay(String(h.value)); setWait(true); setExpr(`${h.expr} =`); }}
                title="Click to reuse this result"
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-white"
              >
                <span className="truncate text-[11px] text-slate-400">{h.expr}</span>
                <span className="shrink-0 text-xs font-bold text-emerald-600 tabular-nums">{fmtAmt(h.value)}</span>
              </button>
            ))}
            <button
              onClick={() => setHistory([])}
              className="mx-auto flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold text-slate-400 transition-colors hover:text-rose-500"
            >
              <X className="h-3 w-3" /> clear history
            </button>
          </div>
        )}

        {/* memory row */}
        <div className="grid grid-cols-4 gap-1.5">
          {([["MC", memClear], ["MR", memRecall], ["M−", memSub], ["M+", memAdd]] as const).map(([label, fn]) => (
            <button key={label} onClick={fn} aria-label={label.replace("M", "Memory ")}
              className="h-8 rounded-lg text-[11px] font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              {label}
            </button>
          ))}
        </div>

        {/* keypad */}
        <div className="grid grid-cols-4 gap-2">
          <button onClick={reset} className={cn(BTN, "border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100")}>AC</button>
          <button onClick={backspace} aria-label="Backspace" className={cn(BTN, FN_CLS)}><Delete className="h-4 w-4" /></button>
          <button onClick={percent} className={cn(BTN, FN_CLS)}>%</button>
          <button onClick={() => chooseOp("÷")} className={cn(BTN, op === "÷" ? OP_ACTIVE : OP_IDLE)}>÷</button>

          {(["7", "8", "9"] as const).map((d) => (
            <button key={d} onClick={() => inputDigit(d)} className={cn(BTN, DIGIT_CLS)}>{d}</button>
          ))}
          <button onClick={() => chooseOp("×")} className={cn(BTN, op === "×" ? OP_ACTIVE : OP_IDLE)}>×</button>

          {(["4", "5", "6"] as const).map((d) => (
            <button key={d} onClick={() => inputDigit(d)} className={cn(BTN, DIGIT_CLS)}>{d}</button>
          ))}
          <button onClick={() => chooseOp("-")} className={cn(BTN, op === "-" ? OP_ACTIVE : OP_IDLE)}>−</button>

          {(["1", "2", "3"] as const).map((d) => (
            <button key={d} onClick={() => inputDigit(d)} className={cn(BTN, DIGIT_CLS)}>{d}</button>
          ))}
          <button onClick={() => chooseOp("+")} className={cn(BTN, op === "+" ? OP_ACTIVE : OP_IDLE)}>+</button>

          <button onClick={toggleSign} className={cn(BTN, FN_CLS)}>±</button>
          <button onClick={() => inputDigit("0")} className={cn(BTN, DIGIT_CLS)}>0</button>
          <button onClick={inputDot} className={cn(BTN, DIGIT_CLS)}>.</button>
          <button onClick={equals} className={cn(BTN, "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700")}>=</button>
        </div>

        {/* push result into the form */}
        {onUse && (
          <Button
            onClick={useAsAmount}
            className="h-11 w-full bg-emerald-600 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <MousePointerClick className="mr-2 h-4 w-4" />
            Use as Amount — {fmtAmt(cur())}
          </Button>
        )}
      </div>
    </div>
  );
}
