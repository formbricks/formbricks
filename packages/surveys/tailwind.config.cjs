/** @type {import('tailwindcss').Config} */
module.exports = {
  important: "#fbjs",
  darkMode: "class",
  corePlugins: {
    preflight: false,
  },
  content: ["./src/**/*.{tsx,ts,jsx,js}"],
  theme: {
    extend: {
      colors: {
        brand: "var(--brand-color)",
        "on-brand": "var(--brand-text-color)",
        border: "var(--border-color)",
        "border-highlight": "var(--border-color-highlight)",
        focus: "var(--focus-color)",
        heading: "var(--heading-color)",
        subheading: "var(--subheading-color)",
        placeholder: "var(--placeholder-color)",
        "info-text": "var(--info-text-color)",
        signature: "var(--signature-text-color)",
        "branding-text": "var(--branding-text-color)",
        "survey-bg": "var(--survey-background-color)",
        "survey-border": "var(--survey-border-color)",
        "accent-bg": "var(--accent-background-color)",
        "accent-selected-bg": "var(--accent-background-color-selected)",
        "input-bg": "var(--input-background-color)",
        "input-bg-selected": "var(--input-background-color-selected)",
        "rating-fill": "var(--rating-fill)",
        "rating-focus": "var(--rating-hover)",
        "rating-selected": "var(--rating-selected)",
        "back-button-border": "var(--back-btn-border)",
        "submit-button-border": "var(--submit-btn-border)",
        "close-button": "var(--close-btn-color)",
        "close-button-focus": "var(--close-btn-color-hover)",
        "calendar-tile": "var(--calendar-tile-color)",
      },
      borderRadius: {
        custom: "var(--border-radius)",
      },
      zIndex: {
        999999: "999999",
      },
    },
  },
  plugins: [],
};
