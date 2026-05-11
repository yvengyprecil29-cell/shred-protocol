import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        shred: {
          bg: "#0a0a0b",
          surface: "#111114",
          surface2: "#18181d",
          border: "#222228",
          accent: "#e8ff3b",
          accent2: "#ff4d4d",
          accent3: "#3bffd4",
          text: "#f0f0f0",
          muted: "#666670",
        },
      },
      fontFamily: {
        display: ["var(--font-bebas)", "sans-serif"],
        sans: ["var(--font-dm)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      maxWidth: {
        "12": "12px",
      },
      borderRadius: {
        shred: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
