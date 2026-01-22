import { supabase } from "@/lib/supabase";

export const customerService = {
  /**
   * Lấy toàn bộ danh sách khách hàng (Dùng cho các danh sách đơn giản)
   */
  async getAllCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Lấy thông tin chi tiết một khách hàng theo biển số
   */
  async getCustomerByPlate(plate: string) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("license_plate", plate)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Lấy danh sách khách hàng kèm thống kê lượt sạc cho trang Admin
   * Đã sửa lỗi hiển thị bằng 0 bằng cách lấy dữ liệu từ total_points
   */
  async getAllCustomersWithStats() {
    // Chúng ta không dùng charging_sessions(count) ở đây nữa 
    // vì dữ liệu Excel không có lịch sử chi tiết.
    // Lấy trực tiếp từ bảng customers giúp dữ liệu hiển thị đúng và nhanh hơn.
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    
    // Ánh xạ (Map) dữ liệu để khớp với các Component giao diện đang sử dụng
    return (data || []).map(customer => ({
      ...customer,
      // Hiển thị con số tổng từ total_points (Excel + Check-in mới)
      // Nếu dữ liệu null/undefined thì mặc định là 0
      total_sessions: customer.total_points || 0 
    }));
  }
};