// app/api/analytics/customer-habits/route.ts
// Dashboard 2 list endpoint: groups charging_sessions by license_plate and
// returns one computed-metrics row per customer who checked in during the
// range. The raw session rows never leave the server — only this small,
// already-aggregated per-customer summary does.
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveAnalyticsRange } from "@/lib/analyticsRange";
import { computeCustomerMetrics } from "@/lib/customerHabits";
import type { CustomerHabitRow, CustomerHabitsResponse } from "@/lib/types/customerHabits";

interface SessionRow {
  license_plate: string;
  start_time: string;
  customers: { full_name: string | null; phone_number: string | null } | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const range = resolveAnalyticsRange(
    searchParams.get("range"),
    searchParams.get("start"),
    searchParams.get("end")
  );
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const { data, error } = await supabaseServer
    .from("charging_sessions")
    .select("license_plate, start_time, customers ( full_name, phone_number )")
    .gte("start_time", range.startISO)
    .lte("start_time", range.endISO)
    .order("start_time", { ascending: true })
    .limit(20000);

  if (error) {
    console.error("Lỗi truy vấn charging_sessions cho customer-habits:", error);
    return NextResponse.json({ error: "Không thể tải dữ liệu." }, { status: 500 });
  }

  const rows: SessionRow[] = data || [];

  const byPlate = new Map<string, { times: string[]; fullName: string | null; phoneNumber: string | null }>();
  for (const row of rows) {
    let entry = byPlate.get(row.license_plate);
    if (!entry) {
      entry = { times: [], fullName: row.customers?.full_name ?? null, phoneNumber: row.customers?.phone_number ?? null };
      byPlate.set(row.license_plate, entry);
    }
    entry.times.push(row.start_time);
  }

  let customers: CustomerHabitRow[] = Array.from(byPlate.entries()).map(([licensePlate, entry]) => {
    const metrics = computeCustomerMetrics(entry.times, range.daysInRange);
    return {
      licensePlate,
      fullName: entry.fullName,
      phoneNumber: entry.phoneNumber,
      ...metrics,
    };
  });

  if (q) {
    customers = customers.filter(
      (c) => c.licensePlate.toLowerCase().includes(q) || (c.fullName?.toLowerCase().includes(q) ?? false)
    );
  }

  // Default sort: most check-ins first — a reasonable landing order before
  // the client applies its own column sort.
  customers.sort((a, b) => b.checkinCount - a.checkinCount);

  const response: CustomerHabitsResponse = {
    range: { type: range.type, startISO: range.startISO, endISO: range.endISO, daysInRange: range.daysInRange },
    customers,
  };

  return NextResponse.json(response);
}
