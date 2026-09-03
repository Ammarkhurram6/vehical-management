import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { FINANCE_CATEGORIES, type FinanceCategory, type FinanceType } from "@/lib/fleet-types";

export const dynamic = "force-dynamic";

/** GET /api/finance?month=YYYY-MM&type=REVENUE|EXPENSE
 *  Returns entries + totals + per-category breakdown. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const month = sp.get("month") || undefined;
  const type = sp.get("type") || undefined;

  const where: Record<string, unknown> = {};
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    where.entryDate = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
  }
  if (type === "REVENUE" || type === "EXPENSE") where.type = type;

  const [entries, allMonths] = await Promise.all([
    db.financialEntry.findMany({ where, orderBy: { entryDate: "desc" }, take: 500 }),
    db.financialEntry.findMany({ distinct: ["entryDate"], select: { entryDate: true } }),
  ]);

  // Totals over the filtered set
  let revenue = 0, expenses = 0;
  const byCategory = new Map<string, number>();
  for (const e of entries) {
    if (e.type === "REVENUE") revenue += e.amount; else expenses += e.amount;
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
  }

  const months = [...new Set(allMonths.map((e) => {
    const d = e.entryDate;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }))].sort().reverse();

  return NextResponse.json({
    entries,
    totals: { revenue, expenses, net: revenue - expenses },
    byCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })),
    months,
  });
}

/** POST /api/finance — add a revenue/expense entry */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body.type as FinanceType;
    const category = body.category as FinanceCategory;
    const amount = Number(body.amount);
    const entryDate = body.entryDate as string;

    if (type !== "REVENUE" && type !== "EXPENSE") {
      return NextResponse.json({ error: "type must be REVENUE or EXPENSE" }, { status: 400 });
    }
    const meta = FINANCE_CATEGORIES[category];
    if (!meta || meta.type !== type) {
      return NextResponse.json({ error: "Invalid category for the selected type" }, { status: 400 });
    }
    if (!isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }
    if (!entryDate || !/^\d{4}-\d{2}-\d{2}/.test(entryDate)) {
      return NextResponse.json({ error: "entryDate must be YYYY-MM-DD" }, { status: 400 });
    }

    // Store as UTC wall-clock midnight
    const [y, m, d] = entryDate.split("-").map(Number);
    const created = await db.financialEntry.create({
      data: {
        type,
        category,
        amount,
        description: (body.description || "").trim() || null,
        vehicleName: (body.vehicleName || "").trim() || null,
        entryDate: new Date(Date.UTC(y, m - 1, d)),
      },
    });

    return NextResponse.json({ ok: true, entry: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
