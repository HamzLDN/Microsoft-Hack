import type { Config } from "tailwindcss";

// Paper style, white and baby blue
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FBFCFD", card: "#FFFFFF", ink: "#1B2733", muted: "#4F5D6B", line: "#DCE6EF",
        baby: "#D9ECFA", sky: "#EEF6FD", accent: "#2F7FC1", good: "#2E7D5B", goodsoft: "#E3F2EA", bad: "#B4473A", badsoft: "#F8E6E3", warn: "#8A6416", warnsoft: "#F6EEDB",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: { paper: "0 1px 2px rgba(27,39,51,.04), 0 8px 24px rgba(27,39,51,.06)" },
    },
  },
  plugins: [],
} satisfies Config;
