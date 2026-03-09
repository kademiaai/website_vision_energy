// @/services/sessionService.ts
import { supabase } from "@/lib/supabase";

export interface SessionFilter {
  filterType: string;
  startDate?: string;
  endDate?: string;
  license_plate?: string;
}

// Định nghĩa interface cho dữ liệu trả về
interface SessionWithCustomer {
  id: string;
  start_time: string;
  license_plate: string;
  station_id: string;
  customers: {
    full_name: string | null;
    phone_number: string | null;
  } | null;
}

export interface TopCustomer {
  license_plate: string;
  full_name: string | null;
  phone_number: string | null;
  total_sessions: number;
  last_session: string | null;
}

export interface ChartData {
  name: string; // Tên hiển thị (rút gọn nếu cần)
  fullName: string; // Tên đầy đủ
  license_plate: string;
  sessions: number;
  color?: string;
}

export const sessionService = {
  /**
   * Lấy dữ liệu lượt sạc dựa trên các bộ lọc
   */
  async getSessions({ filterType, startDate, endDate, license_plate }: SessionFilter) {
    let query = supabase
      .from("charging_sessions")
      .select(`
        id, 
        start_time, 
        license_plate, 
        station_id,
        customers (
          full_name, 
          phone_number
        )
      `)
      .order("start_time", { ascending: false });

    const now = new Date();
    
    // Áp dụng filter thời gian
    if (filterType === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte("start_time", today.toISOString());
    } else if (filterType === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      query = query
        .gte("start_time", yesterday.toISOString())
        .lte("start_time", yesterdayEnd.toISOString());
    } else if (filterType === "7days") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      query = query.gte("start_time", sevenDaysAgo.toISOString());
    } else if (filterType === "30days") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      query = query.gte("start_time", thirtyDaysAgo.toISOString());
    } else if (filterType === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      firstDay.setHours(0, 0, 0, 0);
      query = query.gte("start_time", firstDay.toISOString());
    } else if (filterType === "lastMonth") {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      query = query
        .gte("start_time", firstDay.toISOString())
        .lte("start_time", lastDay.toISOString());
    } else if (filterType === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query
        .gte("start_time", start.toISOString())
        .lte("start_time", end.toISOString());
    }

    // Lọc theo biển số nếu có
    if (license_plate) {
      query = query.eq("license_plate", license_plate.toUpperCase());
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // Ép kiểu dữ liệu
    const typedData = (data || []) as unknown as SessionWithCustomer[];
    
    // Chuyển đổi dữ liệu để dễ sử dụng trong component
    return typedData.map(session => ({
      id: session.id,
      start_time: session.start_time,
      license_plate: session.license_plate,
      station_id: session.station_id,
      customers: session.customers ? {
        full_name: session.customers.full_name,
        phone_number: session.customers.phone_number
      } : null
    }));
  },

  /**
   * Lấy Top khách hàng sạc nhiều nhất theo filter
   */
  async getTopCustomers({ filterType, startDate, endDate }: SessionFilter): Promise<TopCustomer[]> {
    // Lấy tất cả sessions theo filter
    const sessions = await this.getSessions({ filterType, startDate, endDate });
    
    // Nhóm và đếm số lượt theo từng khách hàng
    const customerMap = new Map<string, TopCustomer>();
    
    sessions.forEach(session => {
      const plate = session.license_plate;
      if (!customerMap.has(plate)) {
        customerMap.set(plate, {
          license_plate: plate,
          full_name: session.customers?.full_name || null,
          phone_number: session.customers?.phone_number || null,
          total_sessions: 0,
          last_session: session.start_time
        });
      }
      
      const customer = customerMap.get(plate)!;
      customer.total_sessions++;
      
      // Cập nhật last_session nếu là session mới nhất
      if (new Date(session.start_time) > new Date(customer.last_session!)) {
        customer.last_session = session.start_time;
      }
    });

    // Chuyển về mảng, sắp xếp theo số lượt giảm dần và lấy Top 10
    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.total_sessions - a.total_sessions)
      .slice(0, 10);

    return topCustomers;
  },

  /**
   * Lấy dữ liệu top khách hàng dạng chart
   */
  async getTopCustomersChartData({ filterType, startDate, endDate }: SessionFilter, limit: number = 10): Promise<ChartData[]> {
    const topCustomers = await this.getTopCustomers({ filterType, startDate, endDate });
    
    // Giới hạn số lượng hiển thị (mặc định 10)
    const limitedData = topCustomers.slice(0, limit);
    
    // Mảng màu sắc đẹp cho biểu đồ
    const colors = [
      '#f59e0b', // cam - hạng 1
      '#10b981', // xanh lá - hạng 2
      '#3b82f6', // xanh dương - hạng 3
      '#8b5cf6', // tím
      '#ec4899', // hồng
      '#06b6d4', // cyan
      '#f97316', // cam đậm
      '#84cc16', // xanh lá non
      '#a855f7', // tím nhạt
      '#ef4444'  // đỏ
    ];
    
    // Chuyển đổi dữ liệu cho chart
    return limitedData.map((customer, index) => {
      // Rút gọn biển số nếu quá dài
      let displayName = customer.license_plate;
      if (customer.full_name) {
        // Lấy tên (không lấy họ) để hiển thị ngắn gọn
        const nameParts = customer.full_name.split(' ');
        const shortName = nameParts[nameParts.length - 1];
        displayName = `${shortName} (${customer.license_plate.slice(0, 3)}...)`;
      } else {
        displayName = customer.license_plate.length > 8 
          ? customer.license_plate.slice(0, 5) + '...' 
          : customer.license_plate;
      }
      
      return {
        name: displayName,
        fullName: customer.full_name || 'Khách vãng lai',
        license_plate: customer.license_plate,
        sessions: customer.total_sessions,
        color: colors[index % colors.length]
      };
    });
  },

  /**
   * Hàm tính thống kê nhanh cho các thẻ Stats
   */
  calculateStats(data: any[]) {
    const totalSessions = data.length;
    const uniqueCustomers = new Set(data.map(s => s.license_plate)).size;
    
    // Tính theo giờ (nếu cần)
    const sessionsByHour = data.reduce((acc: any, session) => {
      const hour = new Date(session.start_time).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    return { 
      totalSessions, 
      uniqueCustomers,
      sessionsByHour
    };
  },

  /**
   * Lấy biểu đồ theo ngày
   */
  async getSessionsChartData(filterType: string, startDate?: string, endDate?: string) {
    const sessions = await this.getSessions({ filterType, startDate, endDate });
    
    const chartData: { [key: string]: number } = {};
    
    sessions.forEach(session => {
      const date = new Date(session.start_time).toLocaleDateString('vi-VN');
      chartData[date] = (chartData[date] || 0) + 1;
    });

    return Object.entries(chartData).map(([date, count]) => ({
      date,
      count
    }));
  }
};