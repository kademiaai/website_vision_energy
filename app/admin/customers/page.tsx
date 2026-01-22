"use client";
import { useEffect, useState } from "react";
import { customerService } from "@/services/customerService";
import { 
  Search, UserCircle, Phone, Car, ChevronDown, 
  Trophy, History, Star, RefreshCw
} from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await customerService.getAllCustomersWithStats();
      setCustomers(data || []);
    } catch (error) {
      console.error("Lỗi khi tải danh sách khách hàng:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filtered = customers.filter(c => {
    const searchLower = search.toLowerCase();
    return (
      (c.license_plate?.toLowerCase() || "").includes(searchLower) ||
      (c.full_name?.toLowerCase() || "").includes(searchLower) ||
      (c.phone_number?.toLowerCase() || "").includes(searchLower)
    );
  });

  const sortedCustomers = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return (a.full_name || "").localeCompare(b.full_name || "");
      case "license":
        return (a.license_plate || "").localeCompare(b.license_plate || "");
      case "recent":
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      case "loyalty":
        return (b.total_sessions || 0) - (a.total_sessions || 0);
      default:
        return 0;
    }
  });

  return (
    <div className="space-y-6 animate-in">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Danh bạ khách hàng</h2>
          <p className="text-muted-foreground text-sm">Quản lý và phân loại khách hàng sử dụng trạm</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-card px-4 py-2 rounded-lg border border-border flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground">Tổng cộng</span>
              <span className="text-lg font-bold text-primary">{customers.length} khách</span>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <UserCircle size={20} />
            </div>
          </div>
          <button 
            onClick={fetchCustomers}
            className="p-3 bg-card border border-border rounded-lg hover:bg-secondary/10 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? "animate-spin text-primary" : "text-muted-foreground"} />
          </button>
        </div>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="bg-card p-6 rounded-2xl border border-border">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="lg:col-span-3">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input 
                type="text" 
                placeholder="Tìm tên, biển số hoặc số điện thoại..." 
                className="w-full pl-10 pr-4 py-2.5 bg-secondary/10 border border-input rounded-lg text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all hover:border-primary/50 dark:bg-secondary/10 dark:border-border/80"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Sort Select */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Sắp xếp theo</label>
            <div className="relative">
              <select 
                className="appearance-none w-full bg-card border border-input rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer hover:border-primary/50 dark:bg-secondary/10 dark:border-border/80"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="recent">Mới đăng ký</option>
                <option value="loyalty">Khách sạc nhiều nhất</option>
                <option value="name">Tên khách (A-Z)</option>
                <option value="license">Biển số xe</option>
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <ChevronDown size={16} className="text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOMERS GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-card border border-border rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : sortedCustomers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCustomers.map(customer => (
            <div 
              key={customer.id || Math.random()} 
              className="bg-card p-5 rounded-2xl border border-border hover:border-primary/30 hover:shadow-sm transition-all group"
            >
              {/* VIP Badge */}
              {(customer.total_sessions || 0) >= 10 && (
                <div className="absolute top-4 right-4 bg-accent/10 text-accent p-2 rounded-lg border border-accent/20">
                  <Trophy size={16} />
                </div>
              )}

              <div className="flex flex-col h-full">
                {/* Header Section */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <UserCircle size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-foreground text-base leading-tight truncate">
                      {customer.full_name || "Khách vãng lai"}
                    </h4>
                    <div className="text-xs text-muted-foreground">
                      ID: {customer.id ? customer.id.toString().slice(0, 8) : "N/A"}
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="space-y-3">
                  {/* License Plate */}
                  <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg border border-border/50 group-hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Car size={16} />
                      <span className="text-xs font-medium">Biển số</span>
                    </div>
                    <span className="font-mono font-bold text-primary text-sm">
                      {customer.license_plate || "N/A"}
                    </span>
                  </div>

                  {/* Phone Number */}
                  <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone size={16} />
                      <span className="text-xs font-medium">Liên hệ</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {customer.phone_number || "---"}
                    </span>
                  </div>

                  {/* Total Sessions */}
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20 mt-2">
                    <div className="flex items-center gap-2 text-primary">
                      <History size={16} />
                      <span className="text-xs font-medium">Tổng lượt sạc</span>
                    </div>
                    <span className="text-lg font-bold text-primary">
                      {customer.total_sessions || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card p-12 rounded-2xl border border-border text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-1">Không tìm thấy khách hàng</h3>
              <p className="text-sm text-muted-foreground">
                {search ? 'Thử thay đổi từ khóa tìm kiếm' : 'Chưa có khách hàng nào trong hệ thống'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER INFO */}
      {sortedCustomers.length > 0 && (
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Hiển thị <span className="font-medium text-foreground">{sortedCustomers.length}</span> trong tổng số{' '}
              <span className="font-medium text-foreground">{customers.length}</span> khách hàng
            </p>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent rounded-full text-xs font-medium border border-accent/20">
              <Star size={12} />
              <span>Thành viên VIP: {customers.filter(c => (c.total_sessions || 0) >= 10).length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}