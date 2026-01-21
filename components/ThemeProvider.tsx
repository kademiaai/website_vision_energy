"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Tránh lỗi Hydration bằng cách chỉ render sau khi đã mount ở phía client
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    /* Đưa attribute và defaultTheme vào ĐÂY */
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
      {children}
    </ThemeProvider>
  );
}