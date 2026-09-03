import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateDemoData, resetAllData } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

/** POST /api/demo — seed demo fleet data (optionally force-reset first). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tzOffset = Number(body.tzOffsetMinutes ?? 0);
    if (body.force) await resetAllData();

    const existing = await db.trip.count();
    if (existing > 0) {
      return NextResponse.json({ ok: true, skipped: true, message: "Data already exists. Use force:true to regenerate." });
    }

    const result = await generateDemoData(isFinite(tzOffset) ? tzOffset : 0);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Demo seed failed:", err);
    return NextResponse.json({ error: "Failed to seed demo data" }, { status: 500 });
  }
}

/** DELETE /api/demo — wipe ALL data (trips, finance, ledger) */
export async function DELETE() {
  await resetAllData();
  return NextResponse.json({ ok: true });
}
