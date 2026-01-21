"use client";
import { useState } from "react";
import { Zap, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { translations } from "@/constants/translations";

export default function CheckInForm({ lang }: { lang: string }) {
  const [isNew, setIsNew] = useState(false);
  const t = translations[lang as keyof typeof translations];

  return (
    <div className="bg-card rounded-[2.5rem] p-7 shadow-2xl border border-border transition-all duration-300">
      <h2 className="text-base font-black mb-6 text-foreground flex items-center gap-2 uppercase italic tracking-tighter">
        <div className="p-1.5 bg-primary rounded-lg shadow-lg shadow-primary/20">
          <Zap size={16} className="text-white fill-white" />
        </div>
        {t.checkinTitle}
      </h2>

      <div className="space-y-5">
        <div className="group">
          <label className="text-[10px] font-black uppercase text-slate-400 group-focus-within:text-primary transition-colors ml-1 tracking-widest">
            {t.plateLabel}
          </label>
          {/* FIX INPUT Ở ĐÂY: Dùng bg-background thay vì slate-800 */}
          <input 
            type="text" 
            placeholder="51H-123.45" 
            className="w-full p-4 mt-1 rounded-2xl bg-background border-2 border-transparent focus:border-primary focus:bg-card outline-none font-black text-xl uppercase text-foreground transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner" 
          />
        </div>

        <AnimatePresence>
          {isNew && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: "auto" }} 
              exit={{ opacity: 0, height: 0 }} 
              className="space-y-4 overflow-hidden"
            >
              <input 
                type="text" 
                placeholder={t.nameLabel} 
                className="w-full p-4 rounded-2xl bg-background text-foreground font-bold outline-none border-2 border-transparent focus:border-accent" 
              />
              <input 
                type="tel" 
                placeholder={t.phoneLabel} 
                className="w-full p-4 rounded-2xl bg-background text-foreground font-bold outline-none border-2 border-transparent focus:border-accent" 
              />
            </motion.div>
          )}
        </AnimatePresence>

        <button className="group w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black py-4 rounded-2xl shadow-xl shadow-primary/20 uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2">
          {t.btnConfirm}
          <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>

        <button onClick={() => setIsNew(!isNew)} className="w-full text-center text-[10px] font-black text-slate-400 hover:text-accent uppercase pt-2 transition-colors">
          {isNew ? t.isOld : t.isNew}
        </button>
      </div>
    </div>
  );
}