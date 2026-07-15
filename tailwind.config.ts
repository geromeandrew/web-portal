import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "-apple-system",
          "BlinkMacSystemFont",
          "\"Segoe UI\"",
          "sans-serif",
        ],
        heading: ["Montserrat", "Inter", "-apple-system", "BlinkMacSystemFont", "\"Segoe UI\"", "sans-serif"],
      },
      colors: {
        navy: "#1B2E6E",
        teal: "#1599A0",
        mint: "#E8F8F5",
        "mint-deep": "#D4EFE9",
        ink: "#0f1720",
        mist: "#f4f7fb",
        tide: "#dbe6f1",
        ocean: "#2a5d8f",
        pine: "#2f6b5b",
        coral: "#c7684f",
        gold: "#b38a3d",
      },
      boxShadow: {
        panel: "0 20px 60px rgba(27, 46, 110, 0.12)",
        soft: "0 10px 30px rgba(15, 23, 32, 0.08)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(15, 23, 32, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 32, 0.05) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
