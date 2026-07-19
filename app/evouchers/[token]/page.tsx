"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Gift, Loader2, AlertCircle, Zap, CalendarClock, ExternalLink, CheckCircle } from "lucide-react";
import { evoucherService } from "@/app/services/evoucherService";
import { formatVietnamTime } from "@/lib/timezone";
import type { EVoucher } from "@/lib/types/evoucher";

export default function EVoucherOpenPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [voucher, setVoucher] = useState<EVoucher | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await evoucherService.getVoucherByToken(token);
      if (!data) {
        setError("Link không hợp lệ hoặc e-voucher không tồn tại.");
      } else if (data.status === "available") {
        setError("E-voucher này chưa được gán cho tài khoản nào.");
      } else {
        setVoucher(data);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const handleOpen = async () => {
    if (!voucher || opening) return;
    setOpening(true);
    try {
      const result = await evoucherService.logOpen(token, navigator.userAgent);
      if (!result.success || !result.voucher) {
        setError(result.message);
        return;
      }
      setVoucher(result.voucher);
      window.open(result.voucher.link, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Zap size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold">Vision Energy</h1>
            <p className="text-sm opacity-80">Thẻ quà tặng e-voucher</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {error && !voucher && (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={36} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Không thể truy cập</h2>
            <p className="text-muted-foreground text-sm">{error}</p>
          </div>
        )}

        {voucher && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Gift size={28} className="text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Chúc mừng bạn!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Bạn được tặng một thẻ quà tặng UrBox
              </p>
            </div>

            <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-5 text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Mệnh giá</p>
              <p className="text-3xl font-black text-primary">{voucher.denomination.toLocaleString("vi-VN")}đ</p>
            </div>

            {voucher.expiry_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg p-3">
                <CalendarClock size={16} />
                Hạn sử dụng: {new Date(voucher.expiry_date).toLocaleDateString("vi-VN")}
              </div>
            )}

            {voucher.status === "opened" && (
              <div className="flex items-center gap-2 text-green-600 bg-green-500/10 p-3 rounded-lg text-sm">
                <CheckCircle size={16} />
                Bạn đã mở thẻ quà này. Có thể mở lại bất cứ lúc nào.
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-3 rounded-lg text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              onClick={handleOpen}
              disabled={opening}
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {opening ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <ExternalLink size={18} />
                  {voucher.status === "opened" ? "Mở lại thẻ quà tặng" : "Mở thẻ quà tặng"}
                </>
              )}
            </button>

            <p className="text-xs text-center text-muted-foreground">
              Thẻ quà sẽ mở trong một tab mới trên trang UrBox.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
