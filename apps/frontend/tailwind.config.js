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
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      },
      borderRadius: { card: "14px", field: "10px", pill: "100px" },
    },
  },
  plugins: [],
};
