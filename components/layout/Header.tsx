"use client";
import { useTheme } from "next-themes";
import { Sun, Moon, Languages, MapPin } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { translations } from "@/constants/translations";

export default function Header({ lang, setLang }: { lang: string, setLang: any }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = translations[lang as keyof typeof translations];

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <header className="w-full flex flex-col items-center py-6 gap-6">
      <div className="flex justify-between w-full items-center">
        {/* Toggle Ngôn ngữ - Màu Xanh Dương */}
        <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-full shadow-sm">
          <span className={`text-[9px] font-black ml-2 ${lang === 'vi' ? 'text-accent' : 'text-slate-400'}`}>VI</span>
          <Switch 
            checked={lang === 'en'} 
            onCheckedChange={() => setLang(lang === 'vi' ? 'en' : 'vi')}
            className="data-[state=checked]:bg-accent scale-75"
          />
          <span className={`text-[9px] font-black mr-2 ${lang === 'en' ? 'text-accent' : 'text-slate-400'}`}>EN</span>
        </div>

        {/* Toggle Theme - Màu Xanh Lá */}
        <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-full shadow-sm">
          <Sun size={12} className={theme === 'dark' ? 'text-slate-400' : 'text-primary'} />
          <Switch 
            checked={theme === 'dark'} 
            onCheckedChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="data-[state=checked]:bg-primary scale-75"
          />
          <Moon size={12} className={theme === 'dark' ? 'text-primary' : 'text-slate-400'} />
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tighter uppercase italic">
          <span className="text-primary">ENERGY</span> STATION
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold mt-1 flex items-center justify-center gap-1 uppercase tracking-widest">
          <MapPin size={12} className="text-accent" /> {t.address}
        </p>
      </div>
    </header>
  );
}