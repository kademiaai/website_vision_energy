import type { Config } from "tailwindcss";

const config: Config = {
  // Quan trọng: Phải có dòng này để nút Toggle hoạt động
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Bạn có thể tùy chỉnh thêm màu sắc thương hiệu của Vision Energy ở đây
      colors: {
        brand: {
          light: "#10b981", // Emerald 500
          dark: "#059669",  // Emerald 600
        }
      }
    },
  },
  plugins: [],
};

export default config;