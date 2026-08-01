"use client";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Users, AlertTriangle, DollarSign } from "lucide-react";
import FilterBar from "@/components/analytics/FilterBar";

const TABS = [
  { href: "/admin/analytics/checkin-trends", label: "Xu hướng check-in", icon: <TrendingUp size={16} /> },
  { href: "/admin/analytics/customer-habits", label: "Thói quen khách hàng", icon: <Users size={16} /> },
  { href: "/admin/analytics/anomalies", label: "Cảnh báo bất thường", icon: <AlertTriangle size={16} /> },
  { href: "/admin/analytics/business", label: "Hiệu quả kinh doanh", icon: <DollarSign size={16} /> },
];

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="admin-card">
        <h1 className="text-2xl font-bold text-foreground">Phân tích &amp; Insights</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Xu hướng check-in, thói quen khách hàng, cảnh báo bất thường và hiệu quả kinh doanh.
        </p>
      </div>

      <div className="admin-card p-0">
        <div className="flex gap-1 px-4 md:px-6 pt-4 border-b border-border overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap " +
                  (isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <Suspense fallback={null}>
        <FilterBar />
      </Suspense>

      {children}
    </div>
  );
}
