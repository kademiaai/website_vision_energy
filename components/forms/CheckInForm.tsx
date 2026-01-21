// components/forms/CheckInForm.tsx - Cập nhật với Modal thông báo
"use client";
import { useState } from "react";
import { Car, User, Phone, CheckCircle, AlertCircle, Loader2, X, MessageCircle, Trophy, Zap, ChevronRight, Sparkles, Info, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { translations } from "@/constants/translations";
import { supabase } from "@/lib/supabase";
import { processCheckIn } from "@/services/checkinService";

export default function CheckInForm({ lang }: { lang: string }) {
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCustomerNotFound, setShowCustomerNotFound] = useState(false);
  const [stats, setStats] = useState({ monthly: 0, total: 0 });
  const [formData, setFormData] = useState({ plate: "", name: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const t = translations[lang as keyof typeof translations];

  // --- 1. TỰ ĐỘNG ĐỊNH DẠNG (INPUT MASKING) ---
  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (val.length > 3) {
      val = val.slice(0, 3) + "-" + val.slice(3, 8);
    }
    setFormData({ ...formData, plate: val });
    if (errors.plate) setErrors({ ...errors, plate: "" });
    if (showCustomerNotFound) setShowCustomerNotFound(false);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 7) {
      val = `${val.slice(0, 4)} ${val.slice(4, 7)} ${val.slice(7, 10)}`;
    } else if (val.length > 4) {
      val = `${val.slice(0, 4)} ${val.slice(4, 7)}`;
    }
    setFormData({ ...formData, phone: val });
    if (errors.phone) setErrors({ ...errors, phone: "" });
  };

  // --- 2. VALIDATION ---
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const plateClean = formData.plate.replace("-", "");
    
    if (!plateClean || plateClean.length < 5) {
      newErrors.plate = "Vui lòng nhập biển số hợp lệ";
    }

    if (isNewCustomer) {
      if (!formData.name.trim() || formData.name.trim().split(/\s+/).length < 2) {
        newErrors.name = "Vui lòng nhập họ và tên";
      }
      const phoneClean = formData.phone.replace(/\s/g, "");
      if (!phoneClean || phoneClean.length < 10) {
        newErrors.phone = "Số điện thoại không hợp lệ";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- 3. XỬ LÝ SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const cleanPlate = formData.plate.replace("-", "");
      const cleanPhone = formData.phone.replace(/\s/g, "");

      const { data: customer } = await supabase
        .from('customers')
        .select('license_plate')
        .eq('license_plate', cleanPlate)
        .single();

      if (!customer && !isNewCustomer) {
        // Hiển thị modal thay vì alert
        setShowCustomerNotFound(true);
        setLoading(false);
        return;
      }

      const result = await processCheckIn(
        cleanPlate,
        isNewCustomer ? formData.name.trim() : undefined,
        isNewCustomer ? cleanPhone : undefined
      );

      setStats({
        monthly: result.monthlyCount,
        total: result.totalCount
      });

      setShowSuccess(true);
      setFormData({ plate: "", name: "", phone: "" });
      setErrors({});
    } catch (error: any) {
      alert("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Hàm xử lý khi người dùng đồng ý đăng ký mới
  const handleRegisterNewCustomer = () => {
    setShowCustomerNotFound(false);
    setIsNewCustomer(true);
    // Auto focus vào input tên khi modal đóng
    setTimeout(() => {
      document.querySelector<HTMLInputElement>('input[placeholder*="Họ tên" i], input[placeholder*="Name" i]')?.focus();
    }, 100);
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* FORM CONTAINER */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-8 shadow-2xl shadow-primary/5"
      >
        {/* HEADER */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Zap size={28} className="text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full border-2 border-primary flex items-center justify-center">
                <Sparkles size={10} className="text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                {t.checkinTitle}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t.fillInfoToCharge}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* PLATE INPUT */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                <Car size={18} className="text-primary" />
                {t.plateLabel}
              </label>
              <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                {t.examplePlate}
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={formData.plate}
                onChange={handlePlateChange}
                placeholder="51H-123.45"
                className={`w-full px-6 py-4 text-lg rounded-xl border-2 font-medium tracking-wide transition-all duration-200 focus:outline-none focus:ring-4 ${
                  errors.plate 
                    ? 'border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-400/20' 
                    : 'border-border/70 bg-background/50 focus:border-primary focus:ring-primary/20'
                }`}
              />
              {formData.plate && !errors.plate && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <CheckCircle size={20} className="text-green-500" />
                </div>
              )}
            </div>
            {errors.plate && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle size={14} />
                <span className="font-medium">{errors.plate}</span>
              </div>
            )}
          </div>

          {/* CUSTOMER TYPE SELECTOR */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                type="button"
                onClick={() => setIsNewCustomer(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  !isNewCustomer 
                    ? 'border-primary bg-primary/5 text-primary shadow-sm' 
                    : 'border-border bg-card hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${!isNewCustomer ? 'bg-primary' : 'bg-border'}`} />
                  <span className="font-semibold text-sm">{t.member}</span>
                </div>
              </motion.button>
              
              <motion.button
                type="button"
                onClick={() => setIsNewCustomer(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  isNewCustomer 
                    ? 'border-accent bg-accent/5 text-accent shadow-sm' 
                    : 'border-border bg-card hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isNewCustomer ? 'bg-accent' : 'bg-border'}`} />
                  <span className="font-semibold text-sm">{t.newCustomer}</span>
                </div>
              </motion.button>
            </div>
            
            <div className="text-center">
              <span className="text-xs font-medium text-muted-foreground">
                {isNewCustomer ? t.isNew : t.isOld}
              </span>
            </div>
          </div>

          {/* NEW CUSTOMER FORM */}
          <AnimatePresence>
            {isNewCustomer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6 pt-4 border-t border-border/50"
              >
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                      <User size={18} className="text-accent" />
                      {t.nameLabel}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value.replace(/[0-9]/g, "")})}
                      placeholder={t.nameLabel}
                      className={`w-full px-6 py-4 rounded-xl border-2 bg-background/50 transition-all duration-200 focus:outline-none focus:ring-4 ${
                        errors.name 
                          ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' 
                          : 'border-border/70 focus:border-accent focus:ring-accent/20'
                      }`}
                    />
                    {errors.name && (
                      <div className="flex items-center gap-2 text-sm text-red-500">
                        <AlertCircle size={14} />
                        <span className="font-medium">{errors.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                      <Phone size={18} className="text-accent" />
                      {t.phoneLabel}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={handlePhoneChange}
                      placeholder={t.phoneLabel}
                      className={`w-full px-6 py-4 rounded-xl border-2 bg-background/50 transition-all duration-200 focus:outline-none focus:ring-4 ${
                        errors.phone 
                          ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' 
                          : 'border-border/70 focus:border-accent focus:ring-accent/20'
                      }`}
                    />
                    {errors.phone && (
                      <div className="flex items-center gap-2 text-sm text-red-500">
                        <AlertCircle size={14} />
                        <span className="font-medium">{errors.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SUBMIT BUTTON */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary hover:to-primary/80 text-primary-foreground font-semibold py-5 rounded-xl shadow-lg shadow-primary/25 transition-all duration-200 flex items-center justify-center gap-3 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            {loading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>
                <CheckCircle size={24} />
                <span className="text-lg font-semibold tracking-wide">{t.btnConfirm}</span>
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </motion.button>

          {/* SECURITY NOTE */}
          <div className="text-center pt-4">
            <p className="text-xs font-medium text-muted-foreground/70">
              {t.infoSecured}
            </p>
          </div>
        </form>
      </motion.div>

      {/* MODAL: KHÁCH HÀNG KHÔNG TỒN TẠI */}
      <AnimatePresence>
        {showCustomerNotFound && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/95 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card border border-border/50 rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                    <AlertTriangle size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      {lang === "vi" ? "Xe chưa đăng ký" : "Vehicle Not Registered"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {lang === "vi" ? "Thông tin chưa có trong hệ thống" : "Information not found in system"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomerNotFound(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>

              {/* Message */}
              <div className="space-y-4 mb-8">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <Info size={18} className="text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-900 mb-2">
                        {lang === "vi" ? "Biển số xe này chưa đăng ký" : "This license plate is not registered"}
                      </p>
                      <ul className="text-sm text-amber-800 space-y-1 list-disc pl-4">
                        <li>{lang === "vi" ? "Vui lòng đăng ký thông tin khách hàng mới" : "Please register as a new customer"}</li>
                        <li>{lang === "vi" ? "Miễn phí đăng ký lần đầu" : "First registration is free"}</li>
                        <li>{lang === "vi" ? "Thông tin sẽ được lưu cho lần sau" : "Information will be saved for next time"}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">Biển số:</span>
                  <code className="bg-muted px-3 py-1 rounded-lg font-mono text-foreground font-bold">
                    {formData.plate || "N/A"}
                  </code>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <motion.button
                  onClick={handleRegisterNewCustomer}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent hover:to-accent text-accent-foreground font-semibold py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-accent/25 transition-all"
                >
                  <User size={20} />
                  <span>{lang === "vi" ? "Đăng ký khách hàng mới" : "Register New Customer"}</span>
                  <ChevronRight size={18} />
                </motion.button>

                <button
                  onClick={() => setShowCustomerNotFound(false)}
                  className="w-full border-2 border-border hover:bg-muted/30 text-foreground font-medium py-4 rounded-xl transition-colors"
                >
                  {lang === "vi" ? "Kiểm tra lại biển số" : "Check License Plate Again"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: CHECK-IN THÀNH CÔNG */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/95 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card border border-border/50 rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
                    <Zap size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      {lang === "vi" ? "Check-in thành công!" : "Check-in Successful!"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {lang === "vi" ? "Thông tin đã được lưu trữ" : "Information has been saved"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSuccess(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {lang === "vi" ? "Tháng này" : "This Month"}
                  </p>
                  <p className="text-3xl font-bold text-primary">{stats.monthly}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lang === "vi" ? "lượt sạc" : "charges"}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {lang === "vi" ? "Tổng cộng" : "Total"}
                  </p>
                  <p className="text-3xl font-bold text-accent">{stats.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lang === "vi" ? "lượt sạc" : "charges"}
                  </p>
                </div>
              </div>

              {/* Next Steps */}
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-sm font-medium text-foreground mb-2">
                    <Trophy size={16} className="inline mr-2 text-yellow-500" />
                    {lang === "vi" ? "Bước tiếp theo" : "Next Steps"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {lang === "vi" ? "Vui lòng cắm súng sạc để bắt đầu quá trình sạc" : "Please plug in the charging gun to start"}
                  </p>
                </div>

                {/* Zalo Button */}
                <a
                  href="https://zalo.me/g/isscys844"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02]"
                >
                  <MessageCircle size={20} />
                  <span>{lang === "vi" ? "Tham gia nhóm Zalo hỗ trợ" : "Join Zalo Support Group"}</span>
                </a>

                <p className="text-xs text-center text-muted-foreground/70 pt-2">
                  {lang === "vi" 
                    ? "Nhận thông báo quà tặng & hỗ trợ kỹ thuật 24/7" 
                    : "Receive gift notifications & 24/7 technical support"}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}