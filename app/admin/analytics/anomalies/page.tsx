"use client";
import { useCallback, useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { AlertTriangle, CheckCircle, XCircle, ShieldCheck, Loader2, Info } from "lucide-react";
import type { AnomalyAlert, AnomaliesResponse, ReviewerStatus } from "@/lib/types/anomalies";

const SEVERITY_STYLES: Record<string, string> = {
  cao: "bg-red-500/10 text-red-600",
  trung_binh: "bg-amber-500/10 text-amber-600",
  thap: "bg-blue-500/10 text-blue-600",
};

const SEVERITY_LABELS: Record<string, string> = { cao: "Cao", trung_binh: "Trung bình", thap: "Thấp" };

const STATUS_LABELS: Record<ReviewerStatus, string> = {
  pending: "Chờ xem xét",
  reviewed: "Đã xem xét",
  dismissed: "Đã bỏ qua",
  whitelisted: "Trong danh sách trắng",
};

function Sparkline({ data, markedDate }: { data: { date: string; count: number }[]; markedDate: string | null }) {
  return (
    <ResponsiveContainer width={150} height={40}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="count"
          stroke="#3b82f6"
          strokeWidth={1.5}
          dot={(props: any) => {
            const isMarked = props.payload.date === markedDate;
            return <circle key={props.payload.date} cx={props.cx} cy={props.cy} r={isMarked ? 3.5 : 0} fill="#ef4444" />;
          }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AlertCard({ alert, onReview }: { alert: AnomalyAlert; onReview: (id: string, status: "reviewed" | "dismissed" | "whitelisted") => void }) {
  const isPending = alert.reviewerStatus === "pending";
  return (
    <div className={`admin-card ${!isPending ? "opacity-70" : ""}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`badge ${SEVERITY_STYLES[alert.severity]}`}>{SEVERITY_LABELS[alert.severity]}</span>
            <span className="badge bg-muted text-muted-foreground">{alert.flagTypeLabel}</span>
            {!isPending && <span className="badge bg-muted text-muted-foreground">{STATUS_LABELS[alert.reviewerStatus]}</span>}
          </div>
          <p className="font-medium text-foreground">
            {alert.licensePlate} {alert.fullName && <span className="text-muted-foreground font-normal">— {alert.fullName}</span>}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">{alert.reason}</p>
          <p className="text-xs text-muted-foreground mt-1">{new Date(alert.flaggedAt).toLocaleString("vi-VN")}</p>
          {!isPending && alert.reviewedBy && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Bởi {alert.reviewedBy} lúc {alert.reviewedAt && new Date(alert.reviewedAt).toLocaleString("vi-VN")}
            </p>
          )}
        </div>

        <Sparkline data={alert.sparkline} markedDate={alert.markedDate} />

        {isPending && (
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              onClick={() => onReview(alert.id, "reviewed")}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <CheckCircle size={13} /> Đã xem xét
            </button>
            <button
              onClick={() => onReview(alert.id, "dismissed")}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/70 transition-colors"
            >
              <XCircle size={13} /> Bỏ qua
            </button>
            <button
              onClick={() => onReview(alert.id, "whitelisted")}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition-colors"
            >
              <ShieldCheck size={13} /> Thêm vào danh sách trắng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnomaliesPage() {
  const [data, setData] = useState<AnomaliesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/analytics/anomalies")
      .then(async (res) => {
        if (!res.ok) throw new Error("Không thể tải dữ liệu.");
        return res.json();
      })
      .then((json: AnomaliesResponse) => setData(json))
      .catch((err) => setError(err.message || "Lỗi hệ thống"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReview = async (id: string, status: "reviewed" | "dismissed" | "whitelisted") => {
    await fetch(`/api/analytics/anomalies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadData();
  };

  if (loading) {
    return (
      <div className="admin-card py-16 text-center">
        <Loader2 className="animate-spin mx-auto text-primary" size={28} />
      </div>
    );
  }

  if (error || !data) {
    return <div className="admin-card py-16 text-center text-red-500 text-sm">{error || "Không thể tải dữ liệu."}</div>;
  }

  const pendingAlerts = data.alerts.filter((a) => a.reviewerStatus === "pending");
  const visibleAlerts = showAll ? data.alerts : pendingAlerts;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Đây là các <strong>tín hiệu thống kê cần con người xem xét</strong>, không phải bằng chứng về hành vi gian lận
          hoặc lạm dụng. Vui lòng xác minh trước khi có bất kỳ hành động nào với khách hàng.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pendingAlerts.length} cảnh báo chờ xem xét{showAll ? ` / ${data.alerts.length} tổng cộng` : ""}
        </p>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-sm text-primary hover:underline"
        >
          {showAll ? "Chỉ hiện chờ xem xét" : "Hiện tất cả"}
        </button>
      </div>

      {visibleAlerts.length === 0 ? (
        <div className="admin-card py-16 text-center">
          <Info className="mx-auto mb-3 text-muted-foreground" size={28} />
          <p className="text-muted-foreground text-sm">
            {showAll ? "Chưa có cảnh báo nào." : "Không có cảnh báo nào đang chờ xem xét."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onReview={handleReview} />
          ))}
        </div>
      )}
    </div>
  );
}
