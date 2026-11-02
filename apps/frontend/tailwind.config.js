/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        raised: "var(--raised)",
        ink: { DEFAULT: "var(--ink)", soft: "var(--ink-soft)", faint: "var(--ink-faint)" },
        line: { DEFAULT: "var(--line)", soft: "var(--line-soft)" },
        primary: { DEFAULT: "var(--primary)", tint: "var(--primary-tint)" },
        prof: { DEFAULT: "var(--prof)", tint: "var(--prof-tint)" },
        alt: { DEFAULT: "var(--alt)", tint: "var(--alt-tint)" },
        sync: { DEFAULT: "var(--sync)", tint: "var(--sync-tint)" },
        amber: { DEFAULT: "#9C7A23", tint: "#F1EAD2" },
        orange: { DEFAULT: "#B1602E", tint: "#F3E1D1" },
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      },
      keyframes: {
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "overlay-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "sheet-up": "sheet-up 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        "overlay-in": "overlay-in 200ms ease-out",
      },
      borderRadius: { card: "14px", field: "10px", pill: "100px" },
    },
  },
  plugins: [],
};
