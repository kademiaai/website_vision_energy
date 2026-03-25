// app/admin/sessions/page.tsx
"use client";
import { useEffect, useState } from "react";
import { sessionService } from "@/services/sessionService";
import { 
  Search, Download, ChevronLeft, ChevronRight, 
  RefreshCw, Calendar, ChevronDown, ArrowUpRight,
  FileText, Clock, Battery, TrendingUp
} from "lucide-react";
import * as XLSX from "xlsx";
import Link from "next/link";
import TopCustomersChart from "@/components/TopCustomersChart";

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

  useEffect(() => { 
    loadData(); 
  }, [filterType, dateRange]);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lịch sử sạc</h1>
          <p className="text-muted-foreground text-sm mt-1">Quản lý và theo dõi các lượt sạc trên hệ thống</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="admin-card flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Tổng lượt sạc</div>
              <div className="text-xl font-bold text-foreground">{data.length}</div>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Battery size={20} className="text-primary" />
            </div>
          </div>
          
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            disabled={filteredData.length === 0}
          >
            <Download size={18} />
            <span className="hidden sm:inline">Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="admin-card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Clock className="text-primary" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lượt sạc hôm nay</p>
              <p className="text-2xl font-bold text-foreground">
                {data.filter(item => 
                  new Date(item.start_time).toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="admin-card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <Calendar className="text-accent" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Khoảng thời gian</p>
              <p className="text-2xl font-bold text-foreground">
                {filterType === "today" ? "Hôm nay" : 
                 filterType === "yesterday" ? "Hôm qua" :
                 filterType === "7days" ? "7 ngày" : 
                 filterType === "30days" ? "30 ngày" : 
                 filterType === "month" ? "Tháng này" :
                 filterType === "lastMonth" ? "Tháng trước" :
                 "Tùy chỉnh"}
              </p>
            </div>
          </div>
        </div>
        
        <div className="admin-card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <FileText className="text-green-500" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kết quả tìm kiếm</p>
              <p className="text-2xl font-bold text-foreground">{filteredData.length}</p>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <TrendingUp className="text-purple-500" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Khách hàng</p>
              <p className="text-2xl font-bold text-foreground">
                {new Set(data.map(s => s.license_plate)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="admin-card">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="text-sm font-medium text-foreground mb-2 block">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input 
                type="text" 
                placeholder="Tìm theo biển số, tên khách hàng..." 
                className="admin-input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Time Filter */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Lọc theo thời gian</label>
            <div className="relative">
              <select 
                className="admin-select pl-4 pr-10"
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

          {/* Refresh Button */}
          <div className="flex items-end">
            <button 
              onClick={loadData} 
              className="admin-card flex items-center gap-2 hover:bg-muted transition-colors flex-1 justify-center py-2.5"
              disabled={loading}
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              <span className="text-sm font-medium">Tải lại</span>
            </button>
          </div>
        </div>

        {/* Custom Date Range */}
        {filterType === "custom" && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Từ ngày</label>
              <div className="relative">
                <input 
                  type="date" 
                  className="admin-input"
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  value={dateRange.start}
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Đến ngày</label>
              <div className="relative">
                <input 
                  type="date" 
                  className="admin-input"
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  value={dateRange.end}
                />
              </div>
            </div>
            
            <div className="flex items-end">
              <button 
                onClick={loadData}
                className="admin-card hover:bg-muted transition-colors w-full py-2.5 text-sm font-medium"
              >
                Áp dụng lọc
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* TOP 10 KHÁCH HÀNG - DẠNG CHART */}
      <TopCustomersChart 
        filterType={filterType}
        startDate={dateRange.start}
        endDate={dateRange.end}
      />



      {/* Table */}
      <div className="admin-card overflow-hidden p-0">
        <div className="p-6 border-b border-border">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-lg text-foreground">Danh sách lượt sạc</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? `Tìm thấy ${filteredData.length} kết quả cho "${searchTerm}"` : 'Tất cả lượt sạc'}
              </p>
            </div>
            
            {filteredData.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Trang {currentPage} / {totalPages}
              </div>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4">Thông tin xe</th>
                <th className="px-6 py-4">Khách hàng</th>
                <th className="px-6 py-4">Trạm</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="text-muted-foreground">Đang tải dữ liệu...</p>
                    </div>
                  </td>
                </tr>
              ) : currentData.length > 0 ? (
                currentData.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <Calendar size={16} className="text-foreground"/>
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
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-mono font-medium text-sm">
                        {item.license_plate}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {item.customers?.full_name || "Khách vãng lai"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.customers?.phone || "---"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">
                        Trạm #{item.station_id}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link 
                        href={`/admin/sessions/${item.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <Calendar size={24} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-foreground font-medium mb-1">Không tìm thấy dữ liệu</p>
                        <p className="text-sm text-muted-foreground">
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

        {/* Pagination */}
        {filteredData.length > 0 && (
          <div className="p-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Hiển thị <span className="font-medium text-foreground">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> của{' '}
              <span className="font-medium text-foreground">{filteredData.length}</span> lượt sạc
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-2 rounded-lg bg-card border border-border text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                  {currentPage}
                </span>
                <span className="text-muted-foreground text-sm">/</span>
                <span className="text-foreground text-sm font-medium">{totalPages}</span>
              </div>
              
              <button 
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-2 rounded-lg bg-card border border-border text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}