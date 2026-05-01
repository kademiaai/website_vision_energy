// components/forms/CheckInForm.tsx - Cập nhật với Modal thông báo
"use client";
import { useState, useEffect } from "react";
import { Car, User, Phone, CheckCircle, AlertCircle, Loader2, X, MessageCircle, Trophy, Zap, ChevronRight, Sparkles, Star, Info, AlertTriangle, History } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { translations } from "@/constants/translations";
import { supabase } from "@/lib/supabase";
import { processCheckIn } from "@/app/services/checkinService";
import { rewardService } from "@/app/services/rewardService";
import confetti from "canvas-confetti";
import { Reward, RewardHistoryEntry } from "@/lib/types/reward";

// Helper to format plate: 99H99999 -> 99H-99999
const formatDisplayPlate = (plate: string) => {
  if (!plate) return "";
  const match = plate.match(/^(\d{2}[A-Z])(\d+)$/);
  if (match) return `${match[1]}-${match[2]}`;
  return plate;
};

export default function CheckInForm({ lang }: { lang: string }) {
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCustomerNotFound, setShowCustomerNotFound] = useState(false);
  const [stats, setStats] = useState({ monthly: 0, total: 0, rank: 0, name: "" });
  const [formData, setFormData] = useState({ plate: "", name: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCooldown, setShowCooldown] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [pendingReward, setPendingReward] = useState<{
    reward: any;
    type: "selection" | "completion";
  } | null>(null);
  const [showRewardHistory, setShowRewardHistory] = useState(false);
  const [rewardHistory, setRewardHistory] = useState<RewardHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [lastCheckedPlate, setLastCheckedPlate] = useState("");
  const t = translations[lang as keyof typeof translations];
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);

  // Trigger confetti when a completion notification is shown
  useEffect(() => {
    if (pendingReward?.type === "completion" && pendingReward.reward.id !== lastNotificationId) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0070f3', '#00dfd8', '#ffffff']
      });
      setLastNotificationId(pendingReward.reward.id);
    }
  }, [pendingReward, lastNotificationId]);

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

  // --- 3. XỬ LÝ SUBMIT (Đã cập nhật logic Chặn 2 tiếng) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const cleanPlate = formData.plate.replace("-", "");
      // Persist the last checked plate so the success modal can open history
      // after we clear the form values below.
      setLastCheckedPlate(cleanPlate);
      const cleanPhone = formData.phone.replace(/\s/g, "");

      // 1. Kiểm tra xem khách hàng đã tồn tại chưa (Nếu không phải đang ở mode đăng ký mới)
      if (!isNewCustomer) {
        const { data: customer } = await supabase
          .from('customers')
          .select('license_plate')
          .eq('license_plate', cleanPlate)
          .single();

        if (!customer) {
          setShowCustomerNotFound(true);
          setLoading(false);
          return;
        }
      }

      // 2. Gọi Service xử lý Check-in (Hàm này sẽ check cả logic 120 phút)
      const result = await processCheckIn(
        cleanPlate,
        isNewCustomer ? formData.name.trim() : undefined,
        isNewCustomer ? cleanPhone : undefined
      );
      console.log("Check-in result:", result);

      // Cập nhật thống kê (Dùng chung cho cả 2 modal)
      setStats({
        monthly: result.monthlyCount,
        total: result.totalCount,
        rank: result.rank,
        name: result.customerInfo?.full_name || ""
      });

      // 3. Nếu có phần thưởng chờ thông báo: Ưu tiên hiện modal thưởng
      if (result.pendingReward) {
        console.log("🎁 Pending reward detected, showing reward modal:", result.pendingReward);
        setPendingReward(result.pendingReward);
        setShowSuccess(false); // Đảm bảo modal thành công không che mất
      } else {
        setShowSuccess(true);
      }

      setFormData({ plate: "", name: "", phone: "" });
      setErrors({});
      setIsNewCustomer(false); // Reset về mode khách cũ cho lần sau

    } catch (error: any) {
      // 4. XỬ LÝ LỖI CHẶN THỜI GIAN (COOLDOWN)
      if (error.message?.startsWith("COOLDOWN:")) {
        const minutes = error.message.split(":")[1];
        setRemainingTime(parseInt(minutes));
        setShowCooldown(true);
      } else {
        // Các lỗi hệ thống khác
        console.error("Check-in error:", error);
        alert("Lỗi hệ thống: " + (error.message || "Vui lòng thử lại sau"));
      }
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

  // Hàm xử lý khi đóng modal thành công để hiện modal thưởng
  const handleCloseSuccess = () => {
    setShowSuccess(false);
    if (pendingReward?.type === "completion") {
      // Bắn pháo hoa cho phần thưởng đã duyệt
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0070f3', '#00dfd8', '#ffffff']
      });
    }
  };

  const handleCloseReward = async (confirmReceived: boolean = false) => {
    if (pendingReward) {
      if (confirmReceived) {
        await rewardService.markNotificationAsSeen(pendingReward.reward.id, pendingReward.type);
      }
      setPendingReward(null);
    }
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
                className={`w-full px-6 py-4 text-lg rounded-xl border-2 font-medium tracking-wide transition-all duration-200 focus:outline-none focus:ring-4 ${errors.plate
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
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${!isNewCustomer
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
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${isNewCustomer
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
                      onChange={(e) => setFormData({ ...formData, name: e.target.value.replace(/[0-9]/g, "") })}
                      placeholder={t.nameLabel}
                      className={`w-full px-6 py-4 rounded-xl border-2 bg-background/50 transition-all duration-200 focus:outline-none focus:ring-4 ${errors.name
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
                      className={`w-full px-6 py-4 rounded-xl border-2 bg-background/50 transition-all duration-200 focus:outline-none focus:ring-4 ${errors.phone
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
                  onClick={handleCloseSuccess}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-8">
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">
                    {lang === "vi" ? "Tháng" : "Month"}
                  </p>
                  <p className="text-2xl font-black text-primary">{stats.monthly}</p>
                </div>
                <div className="bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">
                    {lang === "vi" ? "Tổng" : "Total"}
                  </p>
                  <p className="text-2xl font-black text-accent">{stats.total}</p>
                </div>
                <div className="bg-muted/50 border border-border rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">
                    {lang === "vi" ? "Hạng" : "Rank"}
                  </p>
                  <p className="text-2xl font-black text-foreground">#{stats.rank}</p>
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

                {/* History Button */}
                <button
                  onClick={async () => {
                    const plateForHistory = formData.plate
                      ? formData.plate.replace("-", "")
                      : lastCheckedPlate;

                    setLoadingHistory(true);
                    setShowRewardHistory(true);

                    if (!plateForHistory) {
                      // Nothing to query — show empty state
                      setRewardHistory([]);
                      setLoadingHistory(false);
                      return;
                    }

                    try {
                      const history = await rewardService.getRewardHistory(plateForHistory);
                      setRewardHistory(history);
                    } catch (error) {
                      console.error("Lỗi lấy lịch sử:", error);
                      setRewardHistory([]);
                    } finally {
                      setLoadingHistory(false);
                    }
                  }}
                  className="w-full border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-primary font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all"
                >
                  <History size={20} />
                  <span>{lang === "vi" ? "Xem lịch sử & trạng thái quà" : "Reward Status & History"}</span>
                </button>

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

      {/* MODAL: THÔNG BÁO CHỜ (COOLDOWN) */}
      <AnimatePresence>
        {showCooldown && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-card border-2 border-red-500/20 rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle size={40} className="text-red-600 animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Thao tác quá nhanh!</h3>
                <p className="text-muted-foreground mb-6">
                  Hệ thống ghi nhận xe vừa check-in cách đây ít phút. Vui lòng đợi thêm:
                </p>
                <div className="bg-red-50 text-red-700 text-3xl font-black py-4 rounded-2xl mb-8">
                  {remainingTime} {lang === "vi" ? "PHÚT" : "MINS"}
                </div>
                <button
                  onClick={() => setShowCooldown(false)}
                  className="w-full bg-foreground text-background font-bold py-4 rounded-xl hover:opacity-90 transition-opacity"
                >
                  Đã hiểu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: LỊCH SỬ QUÀ TẶNG */}
      <AnimatePresence>
        {showRewardHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-background/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card border border-border/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <History size={20} className="text-primary" />
                  Lịch sử quà tặng
                </h3>
                <button
                  onClick={() => setShowRewardHistory(false)}
                  className="p-1 hover:bg-muted rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {loadingHistory ? (
                  <div className="py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Đang tải lịch sử...</p>
                  </div>
                ) : rewardHistory.length > 0 ? (
                  rewardHistory.map((reward) => (
                    <div
                      key={reward.id}
                      className="p-3 bg-muted/30 rounded-xl border border-border/50 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-sm">Tháng {reward.month}/{reward.year}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(reward.created_at).toLocaleDateString('vi-VN')}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{
                          reward.monthly_rank
                            ? `Hạng ${reward.monthly_rank} · ${reward.monthly_sessions ?? reward.checkin_count} lượt`
                            : `${reward.monthly_sessions ?? reward.checkin_count} lượt`
                        }</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${reward.status === 'completed' ? 'bg-green-100 text-green-700' :
                          reward.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                            reward.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                          }`}>
                          {reward.status === 'completed' ? 'Đã nhận' :
                            reward.status === 'processing' ? 'Đang duyệt' :
                              reward.status === 'rejected' ? 'Từ chối' :
                                'Chưa nhận'}
                        </span>
                        {reward.status === 'eligible' && (
                          <Link
                            href={`/rewards/${reward.token}`}
                            className="block text-[10px] text-primary font-black mt-1 underline"
                          >
                            NHẬN NGAY
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <Trophy size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Bạn chưa có phần thưởng nào.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: THÔNG BÁO PHẦN THƯỞNG (Winner / Completion) */}
      <AnimatePresence>
        {pendingReward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={`relative max-w-[340px] w-full rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.4)] border-2 border-white/20 ${pendingReward.type === "selection"
                ? "bg-gradient-to-b from-amber-500 via-amber-600 to-amber-800"
                : "bg-gradient-to-b from-red-600 via-red-700 to-rose-900"
                }`}
            >
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
              </div>

              <div className="relative p-5 sm:p-6 text-center text-white">
                <button
                  onClick={() => handleCloseReward(false)}
                  className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-full transition-colors z-10"
                >
                  <X size={18} />
                </button>

                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-b from-white/20 to-white/5 backdrop-blur-xl rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-2xl border border-white/30">
                  {pendingReward.type === "selection" ? (
                    <Trophy size={32} className="text-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,0.5)]" />
                  ) : (
                    <Star size={32} className="text-yellow-300 fill-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,0.5)]" />
                  )}
                </div>

                <h3 className="text-[15px] sm:text-[16px] font-black mb-2 tracking-tighter drop-shadow-lg uppercase leading-none">
                  ĐỒNG HÀNH CÙNG VISION ENERGY!
                </h3>

                <div className="bg-black/20 backdrop-blur-md rounded-xl p-3 sm:p-4 mb-4 sm:mb-5 border border-white/10 shadow-inner">
                  <p className="text-xs sm:text-sm text-white font-bold leading-tight">
                    Chúc Mừng <span className="text-yellow-300 block text-base sm:text-lg my-0.5">{formData.name || stats.name || "Quý khách"}</span>
                    xe <span className="text-yellow-300">{formatDisplayPlate(pendingReward.reward.license_plate)}</span> đã đạt phần thưởng của kỳ <span className="text-yellow-300 font-black">{pendingReward.reward.month}/{pendingReward.reward.year}</span>
                  </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 mb-5 sm:mb-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/10">
                    <p className="text-[8px] uppercase font-black text-white/50 mb-0.5 tracking-widest leading-none">Tháng</p>
                    <p className="text-base sm:text-lg font-black leading-none">{stats.monthly}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/10">
                    <p className="text-[8px] uppercase font-black text-white/50 mb-0.5 tracking-widest leading-none">Tổng</p>
                    <p className="text-base sm:text-lg font-black leading-none">{stats.total}</p>
                  </div>
                  <div className="bg-yellow-400/20 backdrop-blur-sm rounded-xl p-2 border border-yellow-400/30">
                    <p className="text-[8px] uppercase font-black text-yellow-300/70 mb-0.5 tracking-widest leading-none">Hạng</p>
                    <p className="text-base sm:text-lg font-black text-yellow-300 leading-none">#{stats.rank}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {pendingReward.type === "selection" ? (
                    <motion.a
                      href={`/rewards/${pendingReward.reward.token}`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="block w-full bg-gradient-to-r from-yellow-300 to-amber-500 text-amber-950 font-black py-3 rounded-lg shadow-xl shadow-yellow-500/20 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm uppercase tracking-wider"
                    >
                      <Zap size={18} />
                      XÁC MINH NHẬN QUÀ
                    </motion.a>
                  ) : (
                    <>
                      <motion.button
                        onClick={() => handleCloseReward(true)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="block w-full bg-white text-red-700 font-black py-3 rounded-lg shadow-xl shadow-black/10 transition-all text-xs sm:text-sm uppercase tracking-wider"
                      >
                        ĐÃ NHẬN ĐƯỢC QUÀ
                      </motion.button>

                      <button
                        onClick={() => handleCloseReward(false)}
                        className="block w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2 rounded-lg transition-all text-[8px] sm:text-[10px] uppercase tracking-widest border border-white/10"
                      >
                        BỎ QUA (NHẮC LẠI SAU)
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-4 sm:mt-5 flex flex-col items-center gap-1 opacity-60">
                  <p className="text-[8px] font-black uppercase tracking-[0.1em] leading-none">
                    {pendingReward.type === "selection"
                      ? "Yêu cầu CCCD để xác minh danh tính"
                      : "Hệ thống Vision Energy tự động"}
                  </p>
                  {pendingReward.reward.rewarded_at && (
                    <p className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider leading-none">
                      DUYỆT LÚC: {new Date(pendingReward.reward.rewarded_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })} - {new Date(pendingReward.reward.rewarded_at).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}