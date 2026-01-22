import { supabase } from "@/lib/supabase";

export const customerService = {
  async getAllCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getCustomerByPlate(plate: string) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("license_plate", plate)
      .single();
    if (error) throw error;
    return data;
  },
  async getAllCustomersWithStats() {
    // Lấy khách hàng và đếm số lượt sạc của họ
    const { data, error } = await supabase
      .from("customers")
      .select(`
        *,
        charging_sessions (count)
      `)
      .order("full_name");

    if (error) throw error;
    
    // Format lại dữ liệu để dễ dùng: { ..., total_sessions: 5 }
    return data.map(c => ({
      ...c,
      total_sessions: c.charging_sessions?.[0]?.count || 0
    }));
  }
};