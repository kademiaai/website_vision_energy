"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, History, Users, Settings, LogOut, Zap,
  Sun, Moon, User
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
    { name: "Cài đặt", href: "/admin/settings", icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex min-h-screen bg-background transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col fixed h-full">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-accent rounded-lg text-white shadow-md">
              <Zap size={22} fill="currentColor" />
            </div>
            <div>
              <div className="font-bold text-sidebar-foreground text-lg leading-tight">
                VISION ENERGY
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                ADMIN SYSTEM
              </div>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3 p-3 bg-sidebar-accent rounded-lg">
            <div className="p-2 bg-primary/10 rounded-full">
              <User size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {userEmail || "Administrator"}
              </p>
              <p className="text-xs text-muted-foreground">Admin</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all border-l-4 ${
                  isActive 
                    ? "bg-gradient-to-r from-primary/10 to-accent/10 border-l-primary text-sidebar-foreground font-semibold" 
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground border-l-transparent"
                }`}
              >
                <div className={isActive ? 'text-primary' : 'text-muted-foreground'}>
                  {item.icon}
                </div>
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Dark Mode Toggle & Logout */}
        <div className="p-4 border-t border-sidebar-border space-y-2">
          {/* Dark Mode Toggle */}
          <button 
            onClick={toggleDarkMode}
            className="flex items-center justify-between w-full px-4 py-3 text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-all text-sm font-medium"
          >
            <div className="flex items-center gap-3">
              {darkMode ? <Moon size={18} /> : <Sun size={18} />}
              <span>{darkMode ? "Dark Mode" : "Light Mode"}</span>
            </div>
            <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-all ${darkMode ? 'bg-primary justify-end' : 'bg-gray-300 justify-start'}`}>
              <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
            </div>
          </button>

          {/* Logout */}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-sidebar-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all text-sm font-medium"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64">
        <div className="p-8">
          {/* Theme Indicator (optional) */}
          <div className="mb-4 text-sm text-muted-foreground flex items-center justify-end gap-2">
            <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-primary' : 'bg-accent'}`}></div>
            {darkMode ? 'Dark Mode' : 'Light Mode'}
          </div>
          
          {children}
        </div>
      </main>
    </div>
  );
}