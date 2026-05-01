"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Trophy, Crown, Medal, ChevronDown, RefreshCw, Gift,
  Link2, CheckCircle, Clock, XCircle, Eye, Award,
  Copy, Check
} from "lucide-react";
import { rewardService } from "@/app/services/rewardService";
import { formatVietnamTime, getCurrentVietnamPeriod } from "@/lib/timezone";
import type { LeaderboardEntry, RewardWithCustomer, Reward, RewardHistoryEntry } from "@/lib/types/reward";

type TabType = "monthly" | "alltime" | "history";

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>("monthly");
  const [loading, setLoading] = useState(true);

  // Monthly filter state
  const currentPeriod = getCurrentVietnamPeriod();
  const [month, setMonth] = useState(currentPeriod.month);
  const [year, setYear] = useState(currentPeriod.year);

  // Data
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rewards, setRewards] = useState<RewardWithCustomer[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<RewardHistoryEntry[]>([]);
  const [historyPlate, setHistoryPlate] = useState<string | null>(null);

  // Selection for reward generation
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Copied token feedback
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Search filter
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLeaderboard = leaderboard.filter((e) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      e.license_plate.toLowerCase().includes(term) ||
      (e.phone_number || "").includes(term) ||
      (e.full_name || "").toLowerCase().includes(term)
    );
  });

  const filteredRewards = rewards.filter((r) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      r.license_plate.toLowerCase().includes(term) ||
      (r.customer_phone || "").includes(term) ||
      (r.customer_name || "").toLowerCase().includes(term) ||
      (r.id_full_name || "").toLowerCase().includes(term)
    );
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "monthly") {
        const data = await rewardService.getMonthlyLeaderboard(month, year);
        setLeaderboard(data);
      } else if (activeTab === "alltime") {
        const data = await rewardService.getAllTimeLeaderboard();
        setLeaderboard(data);
      } else {
        const data = await rewardService.getRewardsByPeriod(month, year);
        setRewards(data);
      }
    } catch (err) {
      console.error("Lỗi tải dữ liệu:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, month, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleSelect = (plate: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(plate)) next.delete(plate);
      else next.add(plate);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filteredLeaderboard.length && filteredLeaderboard.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredLeaderboard.filter(e => !e.reward_status).map((e) => e.license_plate)));
    }
  };

  const handleGenerateLinks = async () => {
    const entries = leaderboard
      .filter((e) => selected.has(e.license_plate) && !e.reward_status)
      .map((e) => ({
        license_plate: e.license_plate,
        month,
        year,
        checkin_count: e.total_sessions,
      }));

    if (entries.length === 0) return;

    try {
      const results = await rewardService.generateRewardTokens(entries);
      alert(`Đã tạo ${results.length} link nhận thưởng!`);
      setSelected(new Set());
      loadData();
    } catch (err) {
      console.error("Lỗi tạo link:", err);
      alert("Có lỗi xảy ra khi tạo link.");
    }
  };

  const handleApprove = async (id: string) => {
    const result = await rewardService.approveReward(id);
    if (result.success) loadData();
    else alert(result.message);
  };

  const handleReject = async (id: string) => {
    const notes = prompt("Lý do từ chối (tùy chọn):");
    const result = await rewardService.rejectReward(id, notes || undefined);
    if (result.success) loadData();
    else alert(result.message);
  };

  const copyRewardLink = (token: string) => {
    const url = `${window.location.origin}/rewards/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={16} className="text-yellow-500" />;
    if (rank === 2) return <Medal size={16} className="text-gray-400" />;
    if (rank === 3) return <Medal size={16} className="text-amber-600" />;
    return <span className="text-sm text-muted-foreground font-mono">#{rank}</span>;
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "eligible":
        return <span className="badge bg-blue-500/10 text-blue-500"><Clock size={12} className="mr-1" /> Chờ gửi</span>;
      case "processing":
        return <span className="badge bg-yellow-500/10 text-yellow-600"><Clock size={12} className="mr-1" /> Đang xử lý</span>;
      case "completed":
        return <span className="badge bg-green-500/10 text-green-600"><CheckCircle size={12} className="mr-1" /> Đã thưởng</span>;
      case "rejected":
        return <span className="badge bg-red-500/10 text-red-600"><XCircle size={12} className="mr-1" /> Từ chối</span>;
      default:
        return <span className="badge bg-muted text-muted-foreground">—</span>;
    }
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <Trophy size={24} className="text-yellow-500" />
              Bảng xếp hạng & Thưởng
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Quản lý xếp hạng và chương trình thưởng khách hàng
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Tìm biển số, SĐT..."
                className="admin-input pl-9 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <RefreshCw 
                size={16} 
                className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${loading ? "animate-spin" : ""}`} 
              />
            </div>

            {/* Month/Year Filter */}
            {activeTab !== "alltime" && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    className="admin-select pl-3 pr-8 py-2 appearance-none w-full"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Tháng {i + 1}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    className="admin-select pl-3 pr-8 py-2 appearance-none w-full"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
              </div>
            )}

            <button
              onClick={loadData}
              className={`p-2.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors ${loading ? "animate-spin" : ""}`}
              disabled={loading}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-border overflow-x-auto">
          {[
            { key: "monthly" as TabType, label: "Xếp hạng tháng", icon: <Trophy size={16} /> },
            { key: "alltime" as TabType, label: "Tất cả thời gian", icon: <Crown size={16} /> },
            { key: "history" as TabType, label: "Lịch sử thưởng", icon: <Gift size={16} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table (Monthly + All-Time) */}
      {(activeTab === "monthly" || activeTab === "alltime") && (
        <div className="admin-card p-0">
          {/* Selection Actions */}
          {activeTab === "monthly" && selected.size > 0 && (
            <div className="p-4 bg-primary/5 border-b border-border flex items-center justify-between">
              <span className="text-sm text-foreground">
                Đã chọn <strong>{selected.size}</strong> khách hàng
              </span>
              <button
                onClick={handleGenerateLinks}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                <Link2 size={16} />
                Tạo link nhận thưởng
              </button>
            </div>
          )}

          <div className="admin-table-container border-0">
            <table className="admin-table">
              <thead>
                <tr>
                  {activeTab === "monthly" && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === filteredLeaderboard.length && filteredLeaderboard.length > 0}
                        onChange={selectAll}
                        className="rounded border-border"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 w-16">Hạng</th>
                  <th className="px-4 py-3">Biển số</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3 text-center">Lượt sạc</th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">Lần thưởng</th>
                  {activeTab === "monthly" && <th className="px-4 py-3 text-center hidden sm:table-cell">Trạng thái</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLeaderboard.map((entry) => (
                  <tr key={entry.license_plate} className={selected.has(entry.license_plate) ? "bg-primary/5" : ""}>
                    {activeTab === "monthly" && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(entry.license_plate)}
                          onChange={() => toggleSelect(entry.license_plate)}
                          className="rounded border-border"
                          disabled={!!entry.reward_status}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      {getRankIcon(entry.rank)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-primary text-sm">{entry.license_plate}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-foreground">{entry.full_name || "Khách vãng lai"}</div>
                      <div className="text-xs text-muted-foreground">{entry.phone_number || "---"}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-foreground">{entry.total_sessions}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {entry.total_rewards_lifetime > 0 ? (
                        <span className="badge bg-amber-500/10 text-amber-600">
                          <Award size={12} className="mr-1" />
                          {entry.total_rewards_lifetime}x
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    {activeTab === "monthly" && (
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {getStatusBadge(entry.reward_status)}
                      </td>
                    )}
                  </tr>
                ))}

                {filteredLeaderboard.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <Trophy className="w-12 h-12 mx-auto mb-2 text-border" />
                      <p>Không tìm thấy kết quả</p>
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reward History Table */}
      {activeTab === "history" && (
        <div className="admin-card p-0">
          <div className="admin-table-container border-0">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="px-2 py-3 text-xs">Biển số</th>
                  <th className="px-2 py-3 text-xs">Khách hàng</th>
                  <th className="px-2 py-3 text-xs hidden lg:table-cell">TÊN CCCD</th>
                  <th className="px-2 py-3 text-center text-xs hidden md:table-cell">Lượt</th>
                  <th className="px-2 py-3 text-center text-xs">Trạng thái</th>
                  <th className="px-2 py-3 text-xs hidden sm:table-cell">Thưởng</th>
                  <th className="px-2 py-3 text-center text-xs hidden lg:table-cell">X.Nhận</th>
                  <th className="px-2 py-3 text-center text-xs hidden md:table-cell">Lần</th>
                  <th className="px-2 py-3 text-center text-xs">H.Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRewards.map((reward) => (
                  <tr key={reward.id}>
                    <td className="px-2 py-3">
                      <span className="font-mono font-bold text-primary text-[11px]">{reward.license_plate}</span>
                    </td>
                    <td className="px-2 py-3">
                      <div className="text-xs font-semibold text-foreground whitespace-nowrap">{reward.customer_name || "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{reward.customer_phone || "—"}</div>
                    </td>
                    <td className="px-2 py-3 hidden lg:table-cell">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">
                        {reward.id_full_name || "—"}
                      </div>
                      <div className="text-[9px] text-muted-foreground font-mono">
                        {reward.id_number || ""}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center text-xs font-bold hidden md:table-cell">{reward.checkin_count}</td>
                    <td className="px-2 py-3 text-center">{getStatusBadge(reward.status)}</td>
                    <td className="px-2 py-3 text-[10px] text-muted-foreground hidden sm:table-cell leading-tight">
                      <div className="font-medium text-foreground">{reward.rewarded_at ? formatVietnamTime(reward.rewarded_at).split(' ')[1] : "—"}</div>
                      <div className="text-[9px] opacity-70">{reward.rewarded_at ? formatVietnamTime(reward.rewarded_at).split(' ')[0] : ""}</div>
                    </td>
                    <td className="px-2 py-3 text-center text-[10px] text-muted-foreground hidden lg:table-cell leading-tight">
                      {reward.completion_seen_at ? (
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-1 font-medium text-green-600">
                            <CheckCircle size={10} />
                            {formatVietnamTime(reward.completion_seen_at).split(' ')[1]}
                          </div>
                          <div className="text-[9px] opacity-70">
                            {formatVietnamTime(reward.completion_seen_at).split(' ')[0]}
                          </div>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-2 py-3 text-center hidden md:table-cell">
                      {reward.total_rewards_lifetime > 0 ? (
                        <span className="badge bg-amber-500/10 text-amber-600 px-1 py-0 text-[10px]">
                          {reward.total_rewards_lifetime}x
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => copyRewardLink(reward.token)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          title="Sao chép link"
                        >
                          {copiedToken === reward.token ? (
                            <Check size={12} className="text-green-500" />
                          ) : (
                            <Copy size={12} className="text-muted-foreground" />
                          )}
                        </button>

                        {reward.status === "processing" && (
                          <>
                            <button
                              onClick={() => handleApprove(reward.id)}
                              className="p-1 rounded hover:bg-green-500/10 transition-colors"
                              title="Duyệt thưởng"
                            >
                              <CheckCircle size={12} className="text-green-500" />
                            </button>
                            <button
                              onClick={() => handleReject(reward.id)}
                              className="p-1 rounded hover:bg-red-500/10 transition-colors"
                              title="Từ chối"
                            >
                              <XCircle size={12} className="text-red-500" />
                            </button>
                          </>
                        )}

                        <button
                          onClick={async () => {
                            // Open quick history modal for this plate
                            setHistoryPlate(reward.license_plate);
                            setHistoryLoading(true);
                            setHistoryOpen(true);
                            try {
                              const data = await rewardService.getRewardHistory(reward.license_plate);
                              setHistoryData(data as Reward[]);
                            } catch (err) {
                              console.error('Lỗi lấy lịch sử thưởng (admin):', err);
                              setHistoryData([]);
                            } finally {
                              setHistoryLoading(false);
                            }
                          }}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          title="Xem lịch sử thưởng"
                        >
                          <Link2 size={12} className="text-muted-foreground" />
                        </button>

                        {reward.id_card_photo_url && (
                          <button
                            onClick={async () => {
                              const url = await rewardService.getIdPhotoUrl(reward.id_card_photo_url!);
                              if (url) window.open(url, "_blank");
                            }}
                            className="p-1 rounded hover:bg-muted transition-colors"
                            title="Xem ảnh CCCD"
                          >
                            <Eye size={12} className="text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredRewards.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <Gift className="w-12 h-12 mx-auto mb-2 text-border" />
                      <p>Không tìm thấy kết quả</p>
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin: Reward history modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Lịch sử thưởng: {historyPlate}</h3>
              <button
                onClick={() => {
                  setHistoryOpen(false);
                  setHistoryData([]);
                  setHistoryPlate(null);
                }}
                className="p-1 rounded hover:bg-muted"
              >
                <XCircle size={16} />
              </button>
            </div>

            {historyLoading ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Đang tải lịch sử...</p>
              </div>
            ) : historyData.length > 0 ? (
              <div className="space-y-2">
                {historyData.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-muted/30 rounded-xl border border-border/50 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-sm">Tháng {r.month}/{r.year}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString('vi-VN')}</p>
                      <p className="text-[10px] text-muted-foreground">{
                        r.monthly_rank ? `Hạng ${r.monthly_rank} · ${r.monthly_sessions ?? r.checkin_count} lượt` : `${r.monthly_sessions ?? r.checkin_count} lượt`
                      }</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${r.status === 'completed' ? 'bg-green-100 text-green-700' : r.status === 'processing' ? 'bg-blue-100 text-blue-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.status === 'completed' ? 'Đã nhận' : r.status === 'processing' ? 'Đang duyệt' : r.status === 'rejected' ? 'Từ chối' : 'Chưa nhận'}
                      </span>
                      {r.status === 'eligible' && (
                        <a href={`/rewards/${r.token}`} className="block text-[10px] text-primary font-black mt-1 underline">NHẬN NGAY</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <p className="text-sm">Không có lịch sử thưởng.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Note: Modal JSX is rendered within the component return above; React will mount it in place.
