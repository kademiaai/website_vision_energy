"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  LogOut, RefreshCw, Search, Car, User, 
  Calendar, Zap, Users, Filter, ChevronLeft, ChevronRight 
} from "lucide-react";

export default function AdminDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTime, setFilterTime] = useState("all"); // all, today, month
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Số dòng trên mỗi trang
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push("/login");
      else fetchData();
    };
    checkAuth();
  }, [router]);

  const fetchData = async () => {
    setLoading(true);
    const { data: sessions, error } = await supabase
      .from("charging_sessions")
      .select(`
        id, start_time, license_plate, station_id,
        customers ( full_name, phone_number )
      `)
      .order("start_time", { ascending: false });

    if (!error) setData(sessions || []);
    setLoading(false);
  };

  // --- LOGIC LỌC VÀ TÌM KIẾM ---
  const filteredData = data.filter(item => {
    const matchSearch = 
      item.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const itemDate = new Date(item.start_time);
    const now = new Date();
    
    if (filterTime === "today") {
      return matchSearch && itemDate.toDateString() === now.toDateString();
    }
    if (filterTime === "month") {
      return matchSearch && itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }
    return matchSearch;
  });

  // --- THỐNG KÊ NHANH ---
  const stats = {
    today: data.filter(i => new Date(i.start_time).toDateString() === new Date().toDateString()).length,
    totalSessions: data.length,
    uniqueCustomers: new Set(data.map(i => i.license_plate)).size,
  };

  // --- PHÂN TRANG ---
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              <Zap className="text-yellow-500 fill-yellow-500" /> Trạm Vision Energy #1
            </h1>
            <p className="text-slate-500">Hệ thống quản lý lượt sạc nội bộ</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-red-600 transition font-medium">
            <LogOut size={20} /> Đăng xuất
          </button>
        </div>

        {/* THẺ THỐNG KÊ (STATS) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Calendar size={24} /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Hôm nay</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats.today} <span className="text-sm font-normal text-slate-400">lượt</span></h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl"><Users size={24} /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Tổng khách hàng</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats.uniqueCustomers} <span className="text-sm font-normal text-slate-400">xe</span></h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Car size={24} /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Tổng lượt sạc</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats.totalSessions} <span className="text-sm font-normal text-slate-400">lượt</span></h3>
            </div>
          </div>
        </div>

        {/* BỘ LỌC VÀ TÌM KIẾM */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" placeholder="Tìm biển số hoặc tên khách..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-blue-400 transition"
              onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={18} className="text-slate-400" />
            <select 
              className="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-medium text-slate-600 outline-none cursor-pointer"
              value={filterTime}
              onChange={(e) => {setFilterTime(e.target.value); setCurrentPage(1);}}
            >
              <option value="all">Tất cả thời gian</option>
              <option value="today">Hôm nay</option>
              <option value="month">Tháng này</option>
            </select>
          </div>
          <button onClick={fetchData} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition">
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* BẢNG DỮ LIỆU */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase">Thời gian</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase">Biển số</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase">Khách hàng</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase">Số điện thoại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedData.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/20 transition">
                  <td className="p-4">
                    <div className="text-sm text-slate-700 font-medium">
                      {new Date(row.start_time).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <div className="text-xs text-slate-400">{new Date(row.start_time).toLocaleDateString('vi-VN')}</div>
                  </td>
                  <td className="p-4 font-mono font-bold text-blue-600">{row.license_plate}</td>
                  <td className="p-4 text-sm text-slate-600 font-medium">{row.customers?.full_name || "---"}</td>
                  <td className="p-4 text-sm text-slate-500">{row.customers?.phone_number || "---"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* PHÂN TRANG UI */}
          <div className="p-4 border-t border-slate-50 flex items-center justify-between bg-slate-50/30">
            <p className="text-xs text-slate-500">Hiển thị {paginatedData.length}/{filteredData.length} kết quả</p>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-1 rounded bg-white border border-slate-200 disabled:opacity-30"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm font-bold px-3 py-1 bg-blue-600 text-white rounded">{currentPage}</span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-1 rounded bg-white border border-slate-200 disabled:opacity-30"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}