"use client"

import React, { useState, useRef, useEffect } from "react";
import { Cog } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  count?: number;
  children: React.ReactNode;
  className?: string;
};

export function SettingsPopover({ count = 0, children, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((s) => !s)}
        className="p-2 rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
        title="Hiển thị cột"
      >
        <Cog size={16} />
        {typeof count === "number" && (
          <span className="ml-1 text-[11px] bg-muted px-2 py-0.5 rounded-full font-semibold">{count}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-card border border-border rounded-lg shadow-lg p-2 z-40">
          {children}
        </div>
      )}
    </div>
  );
}

export default SettingsPopover;
