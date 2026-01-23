"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Zap, Mail, Lock, LogIn, Shield, Eye, EyeOff,
  Battery, Car, Clock
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Thực hiện đăng nhập
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (authError) {
        setError("Email hoặc mật khẩu không chính xác");
        setLoading(false);
        return;
      }

      if (data?.session) {
        // 2. Làm mới router để xóa cache trang cũ
        router.refresh();

        // 3. Đợi một chút để trình duyệt ghi nhận Cookie (Tránh lỗi Race Condition)
        setTimeout(() => {
          // 4. Chuyển hướng cưỡng bức để Middleware kiểm tra lại từ Server
          window.location.replace("/admin");
        }, 150);
      }
    } catch (err) {
      setError("Đã xảy ra lỗi không xác định");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-br from-accent/10 to-primary/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left Column - Branding & Slogan */}
        <div className="hidden lg:block">
          <div className="max-w-lg">
            {/* Logo */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
                <Zap size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-foreground">
                  <span className="text-primary">VISION</span> ENERGY
                </h1>
                <p className="text-muted-foreground font-medium">Trạm sạc điện thông minh</p>
              </div>
            </div>

            {/* Slogan */}
            <div className="space-y-8 mt-12">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Battery size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Sạc nhanh công nghệ cao</h3>
                  <p className="text-muted-foreground">Từ 0-80% chỉ trong 30 phút với công nghệ sạc DC hiện đại</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-accent/10 rounded-xl">
                  <Car size={24} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Quản lý thông minh</h3>
                  <p className="text-muted-foreground">Hệ thống theo dõi và quản lý trạm sạc 24/7</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Clock size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Vận hành liên tục</h3>
                  <p className="text-muted-foreground">Trạm sạc hoạt động 24/7 với đội ngũ hỗ trợ kỹ thuật</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Login Form */}
        <div className="w-full max-w-md mx-auto">
          <div className="admin-card p-8 shadow-xl border border-border/50 bg-card/50 backdrop-blur-sm">
            {/* Form Header */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg">
                    <Zap size={32} className="text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-md border border-border">
                    <Shield size={14} className="text-accent" />
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-foreground mb-2">
                Đăng nhập hệ thống quản lý
              </h2>
              <p className="text-muted-foreground text-sm">
                Nhập thông tin đăng nhập để truy cập vào hệ thống
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Shield size={16} />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email đăng nhập
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type="email"
                    placeholder="admin@visionenergy.vn"
                    className="admin-input pl-10"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="admin-input pl-10 pr-10"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3.5 rounded-lg font-medium hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Đang xác thực...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>Đăng nhập hệ thống</span>
                  </>
                )}
              </button>

              {/* Security Info */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span>Kết nối an toàn</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <span>Mã hóa SSL</span>
                  </div>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-border">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  © {new Date().getFullYear()} Vision Energy Station
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Chỉ dành cho nhân viên được ủy quyền
                </p>
              </div>
            </div>
          </div>

          {/* Mobile Slogan (only show on mobile) */}
          <div className="lg:hidden mt-8 space-y-6">
            <div className="admin-card p-6">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Battery size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-1">Sạc nhanh công nghệ cao</h3>
                    <p className="text-sm text-muted-foreground">Từ 0-80% chỉ trong 30 phút</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-accent/10 rounded-xl">
                    <Car size={20} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-1">Quản lý thông minh</h3>
                    <p className="text-sm text-muted-foreground">Hệ thống theo dõi 24/7</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Clock size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-1">Vận hành liên tục</h3>
                    <p className="text-sm text-muted-foreground">Trạm sạc hoạt động 24/7</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}