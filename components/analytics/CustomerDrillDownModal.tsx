"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Sparkles } from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { CustomerHabitDetail } from "@/lib/types/customerHabits";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
      {label && <p className="font-medium text-foreground mb-1">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function CustomerDrillDownModal({
  licensePlate,
  queryString,
  onClose,
}: {
  licensePlate: string;
  queryString: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<CustomerHabitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/analytics/customer-habits/${encodeURIComponent(licensePlate)}?${queryString}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Không thể tải dữ liệu.");
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setDetail(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [licensePlate, queryString]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-start md:items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl my-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
            <div>
              <h3 className="text-lg font-bold text-foreground">{licensePlate}</h3>
              {detail?.fullName && <p className="text-sm text-muted-foreground">{detail.fullName}</p>}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 md:p-6 space-y-6">
            {loading && (
              <div className="py-12 text-center">
                <Loader2 className="animate-spin mx-auto text-primary" size={28} />
              </div>
            )}

            {error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

            {detail && !loading && (
              <>
                <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">{detail.summarySentence}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Dòng thời gian check-in</h4>
                  {detail.timeline.length >= 2 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="date"
                          type="category"
                          tick={{ fill: "var(--foreground)", fontSize: 10 }}
                          angle={-30}
                          textAnchor="end"
                          height={50}
                        />
                        <YAxis
                          dataKey="hour"
                          type="number"
                          domain={[0, 24]}
                          tickFormatter={(h) => `${h}h`}
                          tick={{ fill: "var(--foreground)", fontSize: 11 }}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Scatter name="Giờ check-in" data={detail.timeline} fill="#3b82f6" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground py-6 text-center">Chưa đủ dữ liệu để phân tích.</p>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Phân bố khoảng cách giữa các lần check-in</h4>
                  {detail.gapHistogram.some((b) => b.count > 0) ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={detail.gapHistogram} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" tick={{ fill: "var(--foreground)", fontSize: 10 }} />
                        <YAxis tick={{ fill: "var(--foreground)", fontSize: 11 }} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" name="Số lần" radius={[4, 4, 0, 0]}>
                          {detail.gapHistogram.map((_, i) => (
                            <Cell key={i} fill="#8b5cf6" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground py-6 text-center">Chưa đủ dữ liệu để phân tích.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
