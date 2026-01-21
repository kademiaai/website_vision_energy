import { Zap, Coffee, Shield, Gift } from "lucide-react";
import { translations } from "@/constants/translations";

export default function Amenities({ lang }: { lang: string }) {
  const t = translations[lang as keyof typeof translations];
  const items = [
    { icon: <Zap size={14}/>, label: lang === "vi" ? "SẠC NHANH 120KW" : "FAST CHARGE", color: "text-primary" },
    { icon: <Coffee size={14}/>, label: "COFFEE & FOOD", color: "text-accent" },
    { icon: <Shield size={14}/>, label: "SECURITY 24/7", color: "text-primary" },
    { icon: <Gift size={14}/>, label: "FREE WATER", color: "text-accent" },
  ];

  return (
    <div className="mt-8 mb-10">
      <h3 className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">
        {t.amenitiesTitle}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-card dark:bg-card border border-border rounded-2xl shadow-sm hover:border-primary/50 transition-all cursor-default">
            <div className={item.color}>{item.icon}</div>
            <span className="text-[9px] font-black text-foreground uppercase tracking-tight">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}