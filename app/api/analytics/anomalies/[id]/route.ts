// app/api/analytics/anomalies/[id]/route.ts
// Records a human review action (Đã xem xét / Bỏ qua / Thêm vào danh sách
// trắng) against one flag — a statistical signal, never a verdict, so this
// only ever changes reviewer_status, never deletes the underlying flag.
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";

const VALID_STATUSES = ["reviewed", "dismissed", "whitelisted"];

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const status = body?.status;

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: userData } = await authClient.auth.getUser();

  const { error } = await supabaseServer
    .from("checkin_flags")
    .update({ reviewer_status: status, reviewed_by: userData.user?.email || null, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Lỗi cập nhật trạng thái xem xét:", error);
    return NextResponse.json({ error: "Không thể cập nhật." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
