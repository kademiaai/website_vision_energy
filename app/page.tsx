"use client";
import { useState } from "react";
import Header from "@/components/layout/Header";
import CheckInForm from "@/components/forms/CheckInForm";
import Amenities from "@/components/sections/Amenities";

export default function HomePage() {
  const [lang, setLang] = useState<"vi" | "en">("vi");

  return (
    <div className="min-h-screen flex justify-center bg-background transition-colors duration-500">
      <div className="w-full max-w-md flex flex-col min-h-screen p-5">
        <Header lang={lang} setLang={setLang} />
        <main className="flex-grow flex flex-col gap-4">
          <CheckInForm lang={lang} />
          <Amenities lang={lang} />
        </main>
        <footer className="py-8 text-center">
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">
             © 2024 Vision Energy System
           </p>
        </footer>
      </div>
    </div>
  );
}