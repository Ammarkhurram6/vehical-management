import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/ledger — Manager "Hisab Kitab" (Saqib): entries + balance totals */
export async function GET() {
  const entries = await db.ledgerEntry.findMany({ orderBy: { entryDate: "desc" }, take: 500 });

  let credited = 0, paid = 0, lastPaymentAt: string | null = null;
  for (const e of entries) {
    if (e.type === "CREDIT") credited += e.amount;
    else {
      paid += e.amount;
      if (!lastPaymentAt || e.entryDate > lastPaymentAt) lastPaymentAt = e.entryDate;
    }
  }
  const balance = credited - paid;

  return NextResponse.json({
    entries,
    totals: {
      balance: Math.round(balance * 100) / 100,
      credited: Math.round(credited * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      lastPaymentAt,
    },
  });
}

/** POST /api/ledger — record a credit (due added) or payment (cleared) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body.type;
    const amount = Number(body.amount);
    const entryDate = body.entryDate as string;

    if (type !== "CREDIT" && type !== "PAYMENT") {
      return NextResponse.json({ error: "type must be CREDIT or PAYMENT" }, { status: 400 });
    }
    if (!isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }
    if (!entryDate || !/^\d{4}-\d{2}-\d{2}/.test(entryDate)) {
      return NextResponse.json({ error: "entryDate must be YYYY-MM-DD" }, { status: 400 });
    }

    const [y, m, d] = entryDate.split("-").map(Number);
    const created = await db.ledgerEntry.create({
      data: {
        type,
        amount,
        description: (body.description || "").trim() || (type === "CREDIT" ? "Due added" : "Payment received"),
        entryDate: new Date(Date.UTC(y, m - 1, d)),
      },
    });

    return NextResponse.json({ ok: true, entry: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
