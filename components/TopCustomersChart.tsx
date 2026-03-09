// @/components/TopCustomersChart.tsx
"use client";
import { useEffect, useState } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell, PieChart, Pie, 
  Sector
} from "recharts";
import { Trophy, TrendingUp, PieChart as PieChartIcon, BarChart2 } from "lucide-react";
import { sessionService, ChartData } from "@/services/sessionService";

interface TopCustomersChartProps {
  filterType: string;
  startDate?: string;
  endDate?: string;
}

// Custom active shape component cho pie chart
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  
  return (
    <g>
      <text x={cx} y={cy - 10} dy={8} textAnchor="middle" fill="currentColor" className="text-sm font-medium">
        {payload.license_plate}
      </text>
      <text x={cx} y={cy + 10} dy={8} textAnchor="middle" fill="currentColor" className="text-xs text-muted-foreground">
        {value} lượt ({(percent * 100).toFixed(1)}%)
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

export default function TopCustomersChart({ filterType, startDate, endDate }: TopCustomersChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    loadChartData();
  }, [filterType, startDate, endDate]);

  const loadChartData = async () => {
    setLoading(true);
    try {
      const chartData = await sessionService.getTopCustomersChartData({ 
        filterType, 
        startDate, 
        endDate 
      }, 10);
      setData(chartData);
    } catch (error) {
      console.error("Lỗi tải dữ liệu chart:", error);
    } finally {
      setLoading(false);
    }
  };

  // Format ngày tháng cho tooltip
  const getDateRangeText = () => {
    switch(filterType) {
      case "today": return "Hôm nay";
      case "yesterday": return "Hôm qua";
      case "7days": return "7 ngày qua";
      case "30days": return "30 ngày qua";
      case "month": return "Tháng này";
      case "lastMonth": return "Tháng trước";
      case "custom": 
        if (startDate && endDate) {
          return `${new Date(startDate).toLocaleDateString('vi-VN')} - ${new Date(endDate).toLocaleDateString('vi-VN')}`;
        }
        return "Khoảng thời gian";
      default: return "Khoảng thời gian";
    }
  };

  // Custom tooltip cho bar chart
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-bold text-foreground">{item.license_plate}</p>
          <p className="text-sm text-muted-foreground">{item.fullName}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
            <p className="text-sm">
              <span className="font-medium">{item.sessions}</span> lượt sạc
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip cho pie chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const total = data.reduce((sum, d) => sum + d.sessions, 0);
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-bold text-foreground">{item.license_plate}</p>
          <p className="text-sm text-muted-foreground">{item.fullName}</p>
          <div className="mt-2">
            <p className="text-sm">
              <span className="font-medium">{item.sessions}</span> lượt sạc
            </p>
            <p className="text-xs text-muted-foreground">
              ({((item.sessions / total) * 100).toFixed(1)}%)
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Hàm xử lý khi hover vào pie chart
  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  if (loading) {
    return (
      <div className="admin-card p-8">
        <div className="flex flex-col items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground mt-3">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="admin-card p-8">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <TrendingUp size={24} className="text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium">Chưa có dữ liệu</p>
          <p className="text-sm text-muted-foreground mt-1">
            Không có lượt sạc nào trong khoảng thời gian này
          </p>
        </div>
      </div>
    );
  }

  const totalSessions = data.reduce((sum, item) => sum + item.sessions, 0);

  return (
    <div className="admin-card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-xl">
            <Trophy size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              TOP {data.length} Khách hàng thân thiết
              <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-1 rounded-full">
                Tổng: {totalSessions} lượt
              </span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {getDateRangeText()}
            </p>
          </div>
        </div>

        {/* Chart Type Toggle */}
        <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-1">
          <button
            onClick={() => setChartType('bar')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              chartType === 'bar' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart2 size={16} />
            <span>Cột</span>
          </button>
          <button
            onClick={() => setChartType('pie')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              chartType === 'pie' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PieChartIcon size={16} />
            <span>Tròn</span>
          </button>
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-6">
        <ResponsiveContainer width="100%" height={400}>
          {chartType === 'bar' ? (
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                tick={{ fill: 'var(--foreground)', fontSize: 12 }}
                stroke="var(--border)"
              />
              <YAxis 
                tick={{ fill: 'var(--foreground)', fontSize: 12 }}
                stroke="var(--border)"
              />
              <Tooltip content={<CustomBarTooltip />} />
              <Legend 
                wrapperStyle={{ color: 'var(--foreground)' }}
                formatter={(value) => <span style={{ color: 'var(--foreground)' }}>Số lượt sạc</span>}
              />
              <Bar dataKey="sessions" name="Số lượt sạc" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={140}
                dataKey="sessions"
                onMouseEnter={onPieEnter}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke={index === activeIndex ? "var(--foreground)" : "none"}
                    strokeWidth={index === activeIndex ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              <Legend 
                layout="vertical" 
                align="right"
                verticalAlign="middle"
                wrapperStyle={{ 
                  color: 'var(--foreground)',
                  fontSize: '12px',
                  paddingLeft: '20px'
                }}
                formatter={(value, entry: any) => {
                  const item = entry.payload;
                  return item ? (
                    <span style={{ color: 'var(--foreground)' }}>
                      {item.license_plate} - {item.sessions} lượt
                    </span>
                  ) : <span></span>;
                }}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Stats Summary */}
      <div className="p-6 border-t border-border bg-muted/20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {data.slice(0, 5).map((item, index) => (
            <div key={item.license_plate} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate" title={item.license_plate}>
                  {index + 1}. {item.license_plate}
                </p>
                <p className="text-xs text-muted-foreground">{item.sessions} lượt</p>
              </div>
            </div>
          ))}
        </div>
        {data.length > 5 && (
          <p className="text-xs text-center text-muted-foreground mt-3">
            và {data.length - 5} khách hàng khác...
          </p>
        )}
      </div>
    </div>
  );
}