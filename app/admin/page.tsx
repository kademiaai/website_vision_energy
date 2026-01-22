"use client";
import { useEffect, useState } from "react";
import { sessionService } from "@/services/sessionService";
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
    <div className="space-y-6 animate-in">
      {/* HEADER & BỘ LỌC */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-2xl shadow-sm border border-border">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground text-sm">Theo dõi hoạt động trạm Vision #1</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Custom Select với styling cho dark mode */}
          <div className="relative">
            <select 
              className="appearance-none bg-card border border-input rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-full cursor-pointer hover:border-primary/50 dark:bg-secondary/10 dark:border-border/80"
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

          {filterType === "custom" && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
              <div className="relative">
                <input 
                  type="date" 
                  className="px-3 py-2 bg-card border border-input rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-32 hover:border-primary/50 dark:bg-secondary/10 dark:border-border/80 [&::-webkit-calendar-picker-indicator]:invert-[var(--tw-invert)] [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  value={dateRange.start}
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground pointer-events-none opacity-70">
                  {dateRange.start || "Từ ngày"}
                </span>
              </div>
              
              <span className="text-muted-foreground">-</span>
              
              <div className="relative">
                <input 
                  type="date" 
                  className="px-3 py-2 bg-card border border-input rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all w-32 hover:border-primary/50 dark:bg-secondary/10 dark:border-border/80 [&::-webkit-calendar-picker-indicator]:invert-[var(--tw-invert)] [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  value={dateRange.end}
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground pointer-events-none opacity-70">
                  {dateRange.end || "Đến ngày"}
                </span>
              </div>
            </div>
          )}
          
          <button 
            onClick={loadData} 
            className={`p-2.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all flex-shrink-0 ${loading ? 'animate-spin' : ''}`}
            title="Refresh data"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<Car className="text-primary" />} 
          label="Lượt sạc" 
          value={stats.totalSessions} 
          color="primary"
        />
        <StatCard 
          icon={<Users className="text-secondary" />} 
          label="Khách hàng" 
          value={stats.uniqueCustomers} 
          color="secondary"
        />
        <StatCard 
          icon={<Calendar className="text-accent" />} 
          label="Hiệu suất" 
          value={stats.totalSessions > 0 ? (stats.totalSessions / 7).toFixed(1) : "0.0"} 
          sub="Lượt/ngày"
          color="accent"
        />
      </div>

      {/* RECENT SESSIONS TABLE */}
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div>
            <h3 className="font-bold text-foreground text-lg">Lượt sạc mới nhất</h3>
            <p className="text-sm text-muted-foreground mt-1">Cập nhật trong 24 giờ qua</p>
          </div>
          <Link 
            href="/admin/sessions" 
            className="text-primary text-sm font-medium hover:underline flex items-center gap-1 hover:gap-2 transition-all group"
          >
            Xem tất cả <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/10 border-b border-border">
              <tr>
                <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Thời gian
                </th>
                <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Biển số
                </th>
                <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Khách hàng
                </th>
                <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.slice(0, 8).map((item) => (
                <tr 
                  key={item.id} 
                  className="hover:bg-secondary/5 transition-colors group"
                >
                  <td className="p-4">
                    <div className="text-sm font-medium text-foreground">
                      {new Date(item.start_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(item.start_time).toLocaleDateString('vi-VN')}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-mono font-bold text-primary text-sm">
                      {item.license_plate}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-medium text-foreground">
                      {item.customers?.full_name || "Khách vãng lai"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.customers?.phone || "---"}
                    </div>
                  </td>
                  <td className="p-4">
                    <Link 
                      href={`/admin/sessions/${item.id}`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-secondary/10 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors group"
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
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
                  <td colSpan={4} className="p-8 text-center">
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

function StatCard({ icon, label, value, sub, color }: any) {
  const colorClasses = {
    primary: "bg-primary/10 border-primary/20",
    secondary: "bg-secondary/10 border-secondary/20",
    accent: "bg-accent/10 border-accent/20",
  };

  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm transition-all hover:shadow-md">
      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 border ${colorClasses[color as keyof typeof colorClasses]}`}>
        {icon}
      </div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-foreground">{value}</h3>
        {sub && <span className="text-sm text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}