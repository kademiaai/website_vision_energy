"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, History, Users, Settings, LogOut, Zap,
  Sun, Moon, User, Trophy
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Kiểm tra theme từ localStorage và system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Lấy thông tin user
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email || null);
    };
    getUser();
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const menuItems = [
    { name: "Tổng quan", href: "/admin", icon: <LayoutDashboard size={20} /> },
    { name: "Lịch sử lượt sạc", href: "/admin/sessions", icon: <History size={20} /> },
    { name: "Khách hàng", href: "/admin/customers", icon: <Users size={20} /> },
    { name: "Xếp hạng & Thưởng", href: "/admin/leaderboard", icon: <Trophy size={20} /> },
    // { name: "Cài đặt", href: "/admin/settings", icon: <Settings size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Sticky for desktop, Fixed for mobile */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col bg-card border-r border-border shadow-2xl lg:shadow-none">
          {/* Logo */}
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary to-accent rounded-lg text-white">
                <Zap size={22} />
              </div>
              <div>
                <div className="font-bold text-foreground text-lg leading-tight">VISION ENERGY</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">ADMIN SYSTEM</div>
              </div>
            </div>
            {/* Close button for mobile */}
            <button 
              className="lg:hidden p-2 hover:bg-muted rounded-lg"
              onClick={() => setSidebarOpen(false)}
            >
              <LogOut size={20} className="rotate-180" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="p-2 bg-primary/10 rounded-full">
                <User size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {userEmail || "Administrator"}
                </p>
                <p className="text-xs text-muted-foreground">Admin</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto" onClick={() => setSidebarOpen(false)}>
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                    ${isActive 
                      ? "bg-primary/10 text-primary font-medium border-l-4 border-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-4 border-transparent"
                    }
                  `}
                >
                  <div className={isActive ? 'text-primary' : 'text-muted-foreground'}>
                    {item.icon}
                  </div>
                  <span className="text-sm">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-border space-y-3">
            {/* Dark Mode Toggle */}
            <button 
              onClick={toggleDarkMode}
              className="flex items-center justify-between w-full px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-all text-sm"
            >
              <div className="flex items-center gap-3">
                {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                <span>{darkMode ? "Dark Mode" : "Light Mode"}</span>
              </div>
              <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-all ${darkMode ? 'bg-primary justify-end' : 'bg-gray-300 justify-start'}`}>
                <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
              </div>
            </button>

            {/* Logout */}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full text-foreground hover:bg-red-500/10 hover:text-red-600 rounded-lg transition-all text-sm"
            >
              <LogOut size={18} />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar - Sticky */}
        <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-sm border-b border-border">
          <div className="px-4 lg:px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Left side - Menu Toggle & Page title */}
              <div className="flex items-center gap-4">
                <button 
                  className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
                  onClick={() => setSidebarOpen(true)}
                >
                  <LayoutDashboard size={24} className="text-primary" />
                </button>
                <div className="text-sm font-semibold text-foreground">
                  {menuItems.find(item => pathname === item.href)?.name || 'Dashboard'}
                </div>
              </div>
              
              {/* Right side - Theme indicator */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="hidden sm:flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-primary' : 'bg-accent'}`}></div>
                  {darkMode ? 'Dark Mode' : 'Light Mode'}
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <User size={16} />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content - Scrollable area */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}