"use client";
import { useEffect, useState } from "react";
import { customerService } from "@/app/services/customerService";
import { 
  Search, UserCircle, Phone, Car, ChevronDown, 
  Trophy, History, Star, RefreshCw,
  Mail, Calendar, Award, Filter
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

  // Tính toán stats
  const vipCount = customers.filter(c => (c.total_sessions || 0) >= 10).length;
  const activeCustomers = customers.filter(c => (c.total_sessions || 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Khách hàng</h1>
          <p className="text-muted-foreground text-sm mt-1">Quản lý thông tin khách hàng sử dụng trạm sạc</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="admin-card flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Tổng khách hàng</div>
              <div className="text-xl font-bold text-foreground">{customers.length}</div>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <UserCircle size={20} className="text-primary" />
            </div>
          </div>
          
          <button 
            onClick={fetchCustomers}
            className={`p-3 bg-card border border-border rounded-lg hover:bg-muted transition-colors ${loading ? 'animate-spin' : ''}`}
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw size={18} className="text-foreground" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="admin-card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <UserCircle className="text-primary" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Khách hàng tích cực</p>
              <p className="text-2xl font-bold text-foreground">{activeCustomers}</p>
            </div>
          </div>
        </div>
        
        <div className="admin-card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <Award className="text-accent" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Thành viên VIP</p>
              <p className="text-2xl font-bold text-foreground">{vipCount}</p>
            </div>
          </div>
        </div>
        
        <div className="admin-card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <History className="text-green-500" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tổng lượt sạc</p>
              <p className="text-2xl font-bold text-foreground">
                {customers.reduce((sum, c) => sum + (c.total_sessions || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="admin-card">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="lg:col-span-3">
            <label className="text-sm font-medium text-foreground mb-2 block">Tìm kiếm khách hàng</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input 
                type="text" 
                placeholder="Tìm theo tên, biển số, số điện thoại..." 
                className="admin-input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Sort Select */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Sắp xếp theo</label>
            <div className="relative">
              <select 
                className="admin-select pl-4 pr-10 appearance-none"
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

      {/* Customers Grid/Table */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="admin-card h-64 animate-pulse">
              <div className="h-8 bg-border rounded mb-4"></div>
              <div className="h-4 bg-border rounded mb-2"></div>
              <div className="h-4 bg-border rounded mb-2"></div>
              <div className="h-4 bg-border rounded"></div>
            </div>
          ))}
        </div>
      ) : sortedCustomers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCustomers.map(customer => {
            const isVIP = (customer.total_sessions || 0) >= 10;
            
            return (
              <div 
                key={customer.id || Math.random()} 
                className="admin-card hover:shadow-md transition-shadow relative"
              >
                {/* VIP Badge */}
                {isVIP && (
                  <div className="absolute top-4 right-4 p-2 bg-accent/10 rounded-lg border border-accent/20">
                    <Trophy size={16} className="text-accent" />
                  </div>
                )}

                <div className="space-y-4">
                  {/* Customer Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <UserCircle size={24} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-foreground text-base truncate">
                        {customer.full_name || "Khách vãng lai"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        ID: {customer.id ? customer.id.toString().slice(0, 8) : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-3">
                    {/* License Plate */}
                    <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Car size={14} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Biển số</span>
                      </div>
                      <span className="font-mono font-medium text-foreground">
                        {customer.license_plate || "N/A"}
                      </span>
                    </div>

                    {/* Phone */}
                    <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Điện thoại</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {customer.phone_number || "---"}
                      </span>
                    </div>

                    {/* Total Sessions */}
                    <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
                      <div className="flex items-center gap-2">
                        <History size={16} className="text-primary" />
                        <span className="text-sm font-medium text-foreground">Tổng lượt sạc</span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">{customer.total_sessions || 0}</div>
                        {isVIP && (
                          <div className="text-xs text-accent font-medium">Thành viên VIP</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Registration Date */}
                  {customer.created_at && (
                    <div className="pt-3 border-t border-border">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar size={12} />
                        <span>Đăng ký: {new Date(customer.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="admin-card text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Search size={24} className="text-muted-foreground" />
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

      {/* Footer Info */}
      {sortedCustomers.length > 0 && (
        <div className="admin-card">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Hiển thị <span className="font-medium text-foreground">{sortedCustomers.length}</span> trong tổng số{' '}
              <span className="font-medium text-foreground">{customers.length}</span> khách hàng
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm border border-primary/20">
                <UserCircle size={14} />
                <span>Tổng: {customers.length}</span>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent rounded-full text-sm border border-accent/20">
                <Star size={14} />
                <span>VIP: {vipCount}</span>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-600 rounded-full text-sm border border-green-500/20">
                <History size={14} />
                <span>Hoạt động: {activeCustomers}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}