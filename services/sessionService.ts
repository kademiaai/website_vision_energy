import { supabase } from "@/lib/supabase";

export const sessionService = {
  // Lấy dữ liệu lượt sạc dựa trên các bộ lọc
  async getSessions({ filterType, startDate, endDate }: { 
    filterType: string; 
    startDate?: string; 
    endDate?: string 
  }) {
    let query = supabase
      .from("charging_sessions")
      .select(`
        id, start_time, license_plate, 
        customers ( full_name, phone_number )
      `)
      .order("start_time", { ascending: false });

    const now = new Date();
    
    if (filterType === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte("start_time", today.toISOString());
    } else if (filterType === "7days") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      query = query.gte("start_time", sevenDaysAgo.toISOString());
    } else if (filterType === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      query = query.gte("start_time", firstDay.toISOString());
    } else if (filterType === "custom" && startDate && endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.gte("start_time", new Date(startDate).toISOString())
                   .lte("start_time", end.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Hàm lấy thống kê nhanh cho các thẻ Stats
  calculateStats(data: any[]) {
    const totalSessions = data.length;
    const uniqueCustomers = new Set(data.map(s => s.license_plate)).size;
    return { totalSessions, uniqueCustomers };
  }
};