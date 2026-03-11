/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/client/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark atmospheric palette
        void: { 900: "#0a0a15", 800: "#0f0f1a", 700: "#12121e", 600: "#1a1a2e", 500: "#2a2a3a" },
        amber: { 400: "#e8a835" },
        emerald: { 400: "#10b981" },
        scarlet: { 400: "#ef4444" },
        iris: { 400: "#8b5cf6", 500: "#6d28d9" },
        sky: { 400: "#35a8e8" },
      },
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "flicker": "flicker 0.15s infinite",
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
