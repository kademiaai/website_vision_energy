"use client";
import { useEffect, useState } from "react";
import { sessionService } from "@/services/sessionService";
import { 
  Search, Download, ChevronLeft, ChevronRight, 
  RefreshCw, Calendar, ChevronDown, ArrowUpRight
} from "lucide-react";
import * as XLSX from "xlsx";
import Link from "next/link";

export default function SessionsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("7days");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  
  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const loadData = async () => {
    setLoading(true);
    try {
      const sessions = await sessionService.getSessions({ 
        filterType, 
        startDate: dateRange.start, 
        endDate: dateRange.end 
      });
      setData(sessions);
      setCurrentPage(1);
    } catch (error) {
      console.error("Lỗi:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filterType, dateRange]);

  // Logic Tìm kiếm & Phân trang
  const filteredData = data.filter(item => 
    item.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.customers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Hàm xuất Excel
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData.map(item => ({
      "Thời gian": new Date(item.start_time).toLocaleString('vi-VN'),
      "Biển số": item.license_plate,
      "Tên khách hàng": item.customers?.full_name || "---",
      "Số điện thoại": item.customers?.phone || "---",
      "Trạm sạc": item.station_id
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "LichSuSac");
    XLSX.writeFile(workbook, `Bao_cao_sac_xe_${filterType}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in">
      {/* HEADER & ACTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Lịch sử lượt sạc</h2>
          <p className="text-muted-foreground text-sm">Quản lý và đối soát dữ liệu toàn hệ thống</p>
        </div>
        <button 
          onClick={exportToExcel}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:shadow-md active:scale-95"
        >
          <Download size={18} /> Xuất Excel ({filteredData.length})
        </button>
      </div>

      {/* TOOLBAR: SEARCH & FILTER */}
      <div className="bg-card p-6 rounded-2xl shadow-sm border border-border grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
        {/* Search Box */}
        <div className="lg:col-span-1 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Tìm kiếm</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Biển số hoặc tên..." 
              className="w-full pl-10 pr-4 py-2.5 bg-secondary/10 border border-input rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all hover:border-primary/50 dark:bg-secondary/10 dark:border-border/80"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Time Filter */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Thời gian</label>
          <div className="relative">
            <select 
              className="appearance-none w-full bg-card border border-input rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer hover:border-primary/50 dark:bg-secondary/10 dark:border-border/80"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="today">Hôm nay</option>
              <option value="yesterday">Hôm qua</option>
              <option value="7days">7 ngày vừa qua</option>
              <option value="30days">30 ngày vừa qua</option>
              <option value="month">Tháng này</option>
              <option value="lastMonth">Tháng trước</option>
              <option value="custom">Tùy chỉnh ngày</option>
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <ChevronDown size={16} className="text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Custom Date Range */}
        {filterType === "custom" && (
          <div className="lg:col-span-1 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-right-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Từ</label>
              <div className="relative">
                <input 
                  type="date" 
                  className="w-full px-3 py-2.5 bg-card border border-input rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all hover:border-primary/50 dark:bg-secondary/10 dark:border-border/80 [&::-webkit-calendar-picker-indicator]:invert-[var(--tw-invert)] [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  value={dateRange.start}
                />
                {!dateRange.start && (
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground pointer-events-none opacity-70">
                    Từ ngày
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Đến</label>
              <div className="relative">
                <input 
                  type="date" 
                  className="w-full px-3 py-2.5 bg-card border border-input rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all hover:border-primary/50 dark:bg-secondary/10 dark:border-border/80 [&::-webkit-calendar-picker-indicator]:invert-[var(--tw-invert)] [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  value={dateRange.end}
                />
                {!dateRange.end && (
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground pointer-events-none opacity-70">
                    Đến ngày
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <button 
          onClick={loadData} 
          className="lg:col-span-auto p-2.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all flex items-center justify-center"
          title="Refresh data"
        >
          <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* DATA TABLE */}
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/10 border-b border-border">
              <tr>
                <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Thời gian
                </th>
                <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Thông tin xe
                </th>
                <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Khách hàng
                </th>
                <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Trạm
                </th>
                <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="text-muted-foreground">Đang tải dữ liệu...</p>
                    </div>
                  </td>
                </tr>
              ) : currentData.length > 0 ? (
                currentData.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary/5 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary/10 rounded-lg text-muted-foreground">
                          <Calendar size={16}/>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {new Date(item.start_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.start_time).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="inline-block px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-mono font-medium text-sm border border-primary/20">
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
                      <span className="text-sm font-medium text-foreground">#{item.station_id}</span>
                    </td>
                    <td className="p-4">
                      <Link 
                        href={`/admin/sessions/${item.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-secondary/10 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center">
                        <Calendar className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-foreground font-medium">Không tìm thấy dữ liệu</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {searchTerm ? 'Thử tìm kiếm với từ khóa khác' : 'Chưa có lượt sạc nào trong khoảng thời gian này'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="p-4 border-t border-border bg-secondary/5 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Hiển thị <span className="font-medium text-foreground">{currentData.length}</span> trong tổng số{' '}
            <span className="font-medium text-foreground">{filteredData.length}</span> kết quả
          </p>
          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="p-2 rounded-lg bg-card border border-input text-foreground hover:bg-secondary/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                {currentPage}
              </span>
              <span className="text-muted-foreground text-sm">/</span>
              <span className="text-foreground text-sm font-medium">{totalPages || 1}</span>
            </div>
            <button 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-2 rounded-lg bg-card border border-input text-foreground hover:bg-secondary/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}