import { supabase } from "@/lib/supabase";

const CHECKIN_INTERVAL = 5; 

export const processCheckIn = async (plate: string, name?: string, phone?: string) => {
  /**
   * CHUẨN HÓA BIỂN SỐ (Cực kỳ quan trọng):
   * 1. .toUpperCase(): Chuyển chữ thường thành chữ hoa.
   * 2. .replace(/[^A-Z0-9]/g, ""): Loại bỏ tất cả ký tự đặc biệt như dấu gạch ngang (-), 
   * dấu chấm (.), khoảng trắng. 
   * Ví dụ: "51F-029.42" hoặc "51f 02942" đều trở thành "51F02942"
   */
  const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // --- BƯỚC 0: KIỂM TRA COOLDOWN (Dùng biển số đã làm sạch) ---
  const { data: lastSession } = await supabase
    .from("charging_sessions")
    .select("start_time")
    .eq("license_plate", cleanPlate)
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSession) {
    const lastTime = new Date(lastSession.start_time).getTime();
    const now = new Date().getTime();
    const diffMinutes = Math.floor((now - lastTime) / (1000 * 60));

    if (diffMinutes < CHECKIN_INTERVAL) {
      throw new Error(`COOLDOWN:${CHECKIN_INTERVAL - diffMinutes}`);
    }
  }

  // --- BƯỚC 1: TRUY VẤN KHÁCH HÀNG ---
  // Tìm kiếm dựa trên biển số đã xóa dấu gạch
  const { data: existingCustomer, error: fetchError } = await supabase
    .from("customers")
    .select("*")
    .eq("license_plate", cleanPlate)
    .maybeSingle();

  if (fetchError) console.error("Lỗi truy vấn khách hàng:", fetchError.message);

  // --- BƯỚC 2: TÍNH TOÁN LƯỢT SẠC ---
  // Lấy giá trị total_points từ Excel (nếu có) cộng thêm 1
  const currentPoints = existingCustomer?.total_points || 0;
  const newTotalPoints = currentPoints + 1;

  // --- BƯỚC 3: CẬP NHẬT/TẠO MỚI (UPSERT) ---
  const { error: upsertError } = await supabase.from("customers").upsert({
    license_plate: cleanPlate,
    total_points: newTotalPoints,
    // Giữ lại tên/sđt cũ từ Excel nếu lần này khách không nhập thông tin mới
    full_name: name?.trim() || existingCustomer?.full_name || "Khách hàng mới",
    phone_number: phone?.trim() || existingCustomer?.phone_number || null,
  }, { onConflict: 'license_plate' });

  if (upsertError) throw upsertError;

  // --- BƯỚC 4: GHI NHẬN LỊCH SỬ CHI TIẾT ---
  await supabase.from("charging_sessions").insert([{ 
    license_plate: cleanPlate,
    status: 'completed',
    station_id: 'station_01' 
  }]);

  // --- BƯỚC 5: TÍNH LƯỢT SẠC TRONG THÁNG ---
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { count: monthlyCount } = await supabase
    .from("charging_sessions")
    .select("*", { count: 'exact', head: true })
    .eq("license_plate", cleanPlate)
    .gte("start_time", firstDayOfMonth);

  return {
    isNewCustomer: !existingCustomer, 
    customerInfo: existingCustomer,
    monthlyCount: monthlyCount || 1,
    totalCount: newTotalPoints
  };
};