// @/services/checkinService.ts
import { supabase } from "@/lib/supabase";

const CHECKIN_INTERVAL = 30; // phút (bạn có thể đổi thành 120 nếu muốn chặn 2 tiếng)

export interface CheckInResult {
  isNewCustomer: boolean;
  customerInfo: any;
  monthlyCount: number;
  totalCount: number;
  message: string;
}

/**
 * Xử lý check-in cho khách hàng
 * @param plate - Biển số xe (đã được làm sạch)
 * @param name - Tên khách hàng (nếu đăng ký mới)
 * @param phone - Số điện thoại (nếu đăng ký mới)
 */
export const processCheckIn = async (
  plate: string,
  name?: string,
  phone?: string
): Promise<CheckInResult> => {
  /**
   * CHUẨN HÓA BIỂN SỐ (Cực kỳ quan trọng):
   * 1. .toUpperCase(): Chuyển chữ thường thành chữ hoa.
   * 2. .replace(/[^A-Z0-9]/g, ""): Loại bỏ tất cả ký tự đặc biệt như dấu gạch ngang (-), 
   * dấu chấm (.), khoảng trắng. 
   * Ví dụ: "51F-029.42" hoặc "51f 02942" đều trở thành "51F02942"
   */
  const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!cleanPlate || cleanPlate.length < 5) {
    throw new Error("Biển số không hợp lệ");
  }

  // --- BƯỚC 1: KIỂM TRA COOLDOWN (Dùng biển số đã làm sạch) ---
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
      // Throw error với format đặc biệt để component có thể bắt và hiển thị cooldown
      throw new Error(`COOLDOWN:${CHECKIN_INTERVAL - diffMinutes}`);
    }
  }

  // --- BƯỚC 2: TRUY VẤN KHÁCH HÀNG ---
  // Tìm kiếm dựa trên biển số đã xóa dấu gạch
  const { data: existingCustomer, error: fetchError } = await supabase
    .from("customers")
    .select("*")
    .eq("license_plate", cleanPlate)
    .maybeSingle();

  if (fetchError) {
    console.error("Lỗi truy vấn khách hàng:", fetchError.message);
    throw new Error("Lỗi hệ thống khi kiểm tra khách hàng");
  }

  // --- BƯỚC 3: TÍNH TOÁN LƯỢT SẠC ---
  // Lấy giá trị total_points từ Excel (nếu có) cộng thêm 1
  const currentPoints = existingCustomer?.total_points || 0;
  const newTotalPoints = currentPoints + 1;

  // --- BƯỚC 4: CẬP NHẬT/TẠO MỚI (UPSERT) ---
  const { error: upsertError } = await supabase.from("customers").upsert(
    {
      license_plate: cleanPlate,
      total_points: newTotalPoints,
      // Giữ lại tên/sđt cũ từ Excel nếu lần này khách không nhập thông tin mới
      full_name: name?.trim() || existingCustomer?.full_name || "Khách hàng mới",
      phone_number: phone?.trim() || existingCustomer?.phone_number || null,
    },
    { onConflict: "license_plate" }
  );

  if (upsertError) {
    console.error("Lỗi upsert:", upsertError);
    throw new Error("Không thể cập nhật thông tin khách hàng");
  }

  // --- BƯỚC 5: GHI NHẬN LỊCH SỬ CHI TIẾT ---
  const { error: insertError } = await supabase.from("charging_sessions").insert([
    {
      license_plate: cleanPlate,
      status: "completed",
      station_id: "station_01",
    },
  ]);

  if (insertError) {
    console.error("Lỗi ghi lịch sử:", insertError);
    // Không throw error ở đây vì đã upsert customer thành công
    // Chỉ log lỗi để debug
  }

  // --- BƯỚC 6: TÍNH LƯỢT SẠC TRONG THÁNG ---
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  const { count: monthlyCount, error: countError } = await supabase
    .from("charging_sessions")
    .select("*", { count: "exact", head: true })
    .eq("license_plate", cleanPlate)
    .gte("start_time", firstDayOfMonth);

  if (countError) {
    console.error("Lỗi đếm lượt tháng:", countError);
  }

  return {
    isNewCustomer: !existingCustomer,
    customerInfo: existingCustomer,
    monthlyCount: monthlyCount || 1,
    totalCount: newTotalPoints,
    message: !existingCustomer
      ? "Đăng ký khách hàng mới thành công!"
      : "Check-in thành công!",
  };
};

/**
 * Kiểm tra biển số đã tồn tại trong hệ thống chưa
 */
export const checkPlateExists = async (plate: string): Promise<boolean> => {
  const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const { data, error } = await supabase
    .from("customers")
    .select("license_plate")
    .eq("license_plate", cleanPlate)
    .maybeSingle();

  if (error) {
    console.error("Lỗi kiểm tra biển số:", error);
    return false;
  }

  return !!data;
};

/**
 * Lấy lịch sử check-in của một khách hàng
 */
export const getCustomerHistory = async (plate: string) => {
  const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const { data, error } = await supabase
    .from("charging_sessions")
    .select(`
      id,
      start_time,
      status,
      station_id,
      customers (
        full_name,
        phone_number,
        total_points
      )
    `)
    .eq("license_plate", cleanPlate)
    .order("start_time", { ascending: false });

  if (error) {
    console.error("Lỗi lấy lịch sử:", error);
    return [];
  }

  return data || [];
};

/**
 * Lấy thống kê nhanh cho một khách hàng
 */
export const getCustomerStats = async (plate: string) => {
  const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Lấy thông tin khách hàng
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("license_plate", cleanPlate)
    .single();

  if (customerError) {
    throw new Error("Không tìm thấy khách hàng");
  }

  // Lấy số lượt trong tháng
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  const { count: monthlyCount, error: countError } = await supabase
    .from("charging_sessions")
    .select("*", { count: "exact", head: true })
    .eq("license_plate", cleanPlate)
    .gte("start_time", firstDayOfMonth);

  if (countError) {
    console.error("Lỗi đếm lượt tháng:", countError);
  }

  return {
    ...customer,
    monthlyCount: monthlyCount || 0,
    totalPoints: customer.total_points || 0,
  };
};