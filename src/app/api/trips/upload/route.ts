import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processCsv } from "@/lib/trip-parser";

export const dynamic = "force-dynamic";

/** POST /api/trips/upload — multipart/form-data with a `file` field (CSV).
 *  Parses the GPS tracking export, groups rows into daily trips using the
 *  ignition ON/OFF transitions and odometer deltas, and stores them. */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "No file uploaded. Attach a CSV file in the 'file' field." },
        { status: 400 }
      );
    }

    const name = (file as File).name || "trips.csv";
    if (!/\.(csv|txt|tsv)$/i.test(name)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a CSV export from your tracking system." },
        { status: 400 }
      );
    }

    const text = await (file as File).text();
    const { trips, report } = processCsv(text, name);

    if (trips.length === 0) {
      return NextResponse.json(
        {
          error:
            "No trips could be extracted. Check that the file has a Timestamp column and ignition (ON/OFF) or movement data.",
          report,
        },
        { status: 422 }
      );
    }

    await db.trip.createMany({
      data: trips.map((t) => ({
        vehicleName: t.vehicleName,
        tripDate: t.tripDate,
        startTime: t.startTime,
        endTime: t.endTime,
        startLocation: t.startLocation,
        endLocation: t.endLocation,
        distanceKm: t.distanceKm,
        maxSpeed: t.maxSpeed,
        avgSpeed: t.avgSpeed,
        durationMin: t.durationMin,
        sourceFile: report.fileName,
      })),
    });

    return NextResponse.json({ ok: true, created: trips.length, report });
  } catch (err) {
    console.error("CSV upload failed:", err);
    return NextResponse.json(
      { error: "Failed to process the CSV file. Please verify the format and try again." },
      { status: 500 }
    );
  }
}
