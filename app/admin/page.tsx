"use client";
import { useEffect, useState } from "react";
import { sessionService } from "@/app/services/sessionService";
import { 
  Calendar, Users, Car, RefreshCw, ChevronRight, ArrowUpRight,
  ChevronDown
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("7days");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const loadData = async () => {
    setLoading(true);
    try {
      const sessions = await sessionService.getSessions({ 
        filterType, 
        startDate: dateRange.start, 
        endDate: dateRange.end 
      });
      setData(sessions);
    } catch (error) {
      console.error("Lỗi:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filterType, dateRange]);

  const stats = sessionService.calculateStats(data);

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="admin-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Theo dõi hoạt động trạm Vision #1</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Filter Select */}
            <div className="relative flex-1 sm:flex-none">
              <select 
                className="admin-select pl-4 pr-10 py-2.5 w-full sm:w-48 appearance-none"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="today">Hôm nay</option>
                <option value="yesterday">Hôm qua</option>
                <option value="7days">7 ngày qua</option>
                <option value="30days">30 ngày qua</option>
                <option value="month">Tháng này</option>
                <option value="lastMonth">Tháng trước</option>
                <option value="custom">Tùy chỉnh ngày</option>
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <ChevronDown size={16} className="text-muted-foreground" />
              </div>
            </div>

            {/* Date Range (chỉ hiện khi chọn custom) */}
            {filterType === "custom" && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input 
                    type="date" 
                    className="admin-input py-2.5"
                    onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                    value={dateRange.start}
                  />
                </div>
                
                <span className="text-muted-foreground">-</span>
                
                <div className="relative flex-1">
                  <input 
                    type="date" 
                    className="admin-input py-2.5"
                    onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                    value={dateRange.end}
                  />
                </div>
              </div>
            )}
            
            {/* Refresh Button */}
            <button 
              onClick={loadData} 
              className={`p-2.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors flex-shrink-0 ${loading ? 'animate-spin' : ''}`}
              title="Refresh data"
              disabled={loading}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<Car className="text-primary" size={20} />} 
          label="Lượt sạc" 
          value={stats.totalSessions} 
          description="Tổng số lượt"
        />
        <StatCard 
          icon={<Users className="text-accent" size={20} />} 
          label="Khách hàng" 
          value={stats.uniqueCustomers} 
          description="Người dùng duy nhất"
        />
        <StatCard 
          icon={<Calendar className="text-primary" size={20} />} 
          label="Hiệu suất" 
          value={stats.totalSessions > 0 ? (stats.totalSessions / 7).toFixed(1) : "0.0"} 
          description="Lượt/ngày"
        />
      </div>

      {/* Recent Sessions Table */}
      <div className="admin-card">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-foreground text-lg">Lượt sạc mới nhất</h3>
            <p className="text-sm text-muted-foreground mt-1">Cập nhật trong 24 giờ qua</p>
          </div>
          <Link 
            href="/admin/sessions" 
            className="text-primary text-sm font-medium hover:underline flex items-center gap-1 hover:gap-2 transition-all"
          >
            Xem tất cả <ChevronRight size={16} />
          </Link>
        </div>
        
        <div className="admin-table-container mt-4">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Biển số</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.slice(0, 8).map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">
                      {new Date(item.start_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(item.start_time).toLocaleDateString('vi-VN')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-primary text-sm">
                      {item.license_plate}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">
                      {item.customers?.full_name || "Khách vãng lai"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.customers?.phone || "---"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link 
                      href={`/admin/sessions/${item.id}`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
              
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Car className="w-12 h-12 text-border" />
                      <p>Chưa có lượt sạc nào</p>
                      <p className="text-sm">Dữ liệu sẽ hiển thị khi có khách hàng sử dụng</p>
                    </div>
                  </td>
                </tr>
              )}
              
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, description }: any) {
  return (
    <div className="admin-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              {icon}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <h3 className="text-2xl font-bold text-foreground mt-1">{value}</h3>
        </div>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground mt-3">{description}</p>
      )}
    </div>
  );
}