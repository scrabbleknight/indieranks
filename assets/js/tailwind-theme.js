window.tailwind = window.tailwind || {};
window.tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      maxWidth: {
        shell: "74rem",
      },
      colors: {
        ink: "#060607",
        surface: "#0d0f12",
        panel: "#111317",
        line: "#20232a",
        muted: "#98a0ad",
        accent: "#6ee7b7",
        signal: "#7dd3fc",
        gold: "#d4b06a",
        rose: "#fb7185",
      },
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["DM Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        snugger: "-0.04em",
      },
      boxShadow: {
        soft: "0 0 0 1px rgba(255,255,255,0.05), 0 26px 80px rgba(0,0,0,0.45)",
        glow: "0 0 0 1px rgba(255,255,255,0.07), 0 0 80px rgba(110,231,183,0.12)",
      },
      backgroundImage: {
        "site-grid":
          "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
      },
    },
  },
};
