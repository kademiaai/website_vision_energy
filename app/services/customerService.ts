// @/app/services/customerService.ts
import { supabase } from "@/lib/supabase";

export interface DateFilter {
  type: 'day' | 'month' | 'year' | 'custom' | '7days' | '30days';
  startDate?: string;
  endDate?: string;
  month?: number;
  year?: number;
}

export interface CustomerRanking {
  license_plate: string;
  full_name: string | null;
  phone_number: string | null;
  total_sessions: number;
  last_session: string | null;
  rank: number;
  is_vip: boolean;
}

// Định nghĩa interface cho dữ liệu trả về từ Supabase
interface SessionWithCustomer {
  license_plate: string;
  start_time: string;
  customers: {
    full_name: string | null;
    phone_number: string | null;
  } | null;
}

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
   * Sử dụng total_points từ bảng customers (đã bao gồm dữ liệu từ Excel + Check-in)
   */
  async getAllCustomersWithStats() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    
    return (data || []).map(customer => ({
      ...customer,
      total_sessions: customer.total_points || 0,
      last_session: null // Có thể bỏ qua vì không có trong customers table
    }));
  },

  /**
   * Lấy xếp hạng khách hàng theo khoảng thời gian
   * QUAN TRỌNG: Dùng charging_sessions để đếm chính xác theo filter
   */
  async getCustomerRankings(filter: DateFilter): Promise<CustomerRanking[]> {
    let query = supabase
      .from('charging_sessions')
      .select(`
        license_plate,
        start_time,
        customers (
          full_name,
          phone_number
        )
      `);

    // Áp dụng filter theo thời gian
    const { startDate, endDate } = this.getDateRangeFromFilter(filter);
    
    if (startDate) {
      query = query.gte('start_time', startDate);
    }
    if (endDate) {
      query = query.lte('start_time', endDate);
    }

    const { data: sessions, error } = await query;

    if (error) throw error;

    // Ép kiểu dữ liệu để TypeScript hiểu
    const typedSessions = (sessions || []) as unknown as SessionWithCustomer[];

    // Nhóm và đếm số lượt sạc theo từng khách hàng
    const customerMap = new Map<string, CustomerRanking>();
    
    typedSessions.forEach(session => {
      const plate = session.license_plate;
      if (!customerMap.has(plate)) {
        // Lấy thông tin customer, xử lý trường hợp customers là mảng hoặc null
        const customerInfo = session.customers;
        
        customerMap.set(plate, {
          license_plate: plate,
          full_name: customerInfo?.full_name || null,
          phone_number: customerInfo?.phone_number || null,
          total_sessions: 0,
          last_session: null,
          rank: 0,
          is_vip: false
        });
      }
      
      const customer = customerMap.get(plate)!;
      customer.total_sessions++;
      
      // Cập nhật last_session nếu là session mới nhất
      if (!customer.last_session || new Date(session.start_time) > new Date(customer.last_session)) {
        customer.last_session = session.start_time;
      }
    });

    // Chuyển về mảng và sắp xếp theo số lượt sạc giảm dần
    const rankings = Array.from(customerMap.values())
      .sort((a, b) => b.total_sessions - a.total_sessions)
      .map((customer, index) => ({
        ...customer,
        rank: index + 1,
        is_vip: customer.total_sessions >= 10
      }));

    return rankings;
  },

  /**
   * Helper function để xác định khoảng thời gian dựa trên filter
   */
  getDateRangeFromFilter(filter: DateFilter): { startDate: string | null, endDate: string | null } {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = now;

    switch (filter.type) {
      case 'day':
        if (filter.startDate) {
          startDate = new Date(filter.startDate);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(filter.startDate);
          endDate.setHours(23, 59, 59, 999);
        }
        break;

      case 'month':
        if (filter.month && filter.year) {
          startDate = new Date(filter.year, filter.month - 1, 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(filter.year, filter.month, 0, 23, 59, 59, 999);
        }
        break;

      case 'year':
        if (filter.year) {
          startDate = new Date(filter.year, 0, 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(filter.year, 11, 31, 23, 59, 59, 999);
        }
        break;

      case '7days':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;

      case '30days':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'custom':
        if (filter.startDate) {
          startDate = new Date(filter.startDate);
          startDate.setHours(0, 0, 0, 0);
        }
        if (filter.endDate) {
          endDate = new Date(filter.endDate);
          endDate.setHours(23, 59, 59, 999);
        }
        break;
    }

    return {
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null
    };
  },

  /**
   * Lấy thống kê nhanh cho dashboard
   */
  async getQuickStats() {
    // Lấy tổng số khách hàng
    const { count: totalCustomers, error: customerError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    if (customerError) throw customerError;

    // Lấy thống kê từ charging_sessions
    const { data: sessions, error: sessionError } = await supabase
      .from('charging_sessions')
      .select('license_plate, start_time');

    if (sessionError) throw sessionError;

    const totalSessions = sessions?.length || 0;
    const uniqueCustomers = new Set(sessions?.map(s => s.license_plate)).size;

    // Lấy số lượt hôm nay
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySessions = sessions?.filter(s => 
      new Date(s.start_time) >= today
    ).length || 0;

    // Lấy số lượt trong tháng này
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthSessions = sessions?.filter(s => 
      new Date(s.start_time) >= firstDayOfMonth
    ).length || 0;

    return {
      totalCustomers: totalCustomers || 0,
      totalSessions,
      uniqueCustomers,
      todaySessions,
      monthSessions,
      averagePerDay: totalSessions > 0 ? (totalSessions / 30).toFixed(1) : 0
    };
  },

  /**
   * Tìm kiếm khách hàng theo nhiều tiêu chí
   */
  async searchCustomers(keyword: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .or(`license_plate.ilike.%${keyword}%,full_name.ilike.%${keyword}%,phone_number.ilike.%${keyword}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};