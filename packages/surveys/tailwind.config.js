/** @type {import('tailwindcss').Config} */
module.exports = {
  important: "#fbjs",
  darkMode: "class",
  corePlugins: {
    preflight: false,
  },
  content: ["./src/**/*.{tsx,ts,jsx,js}"],
  theme: {
    colors: {
      brand: "var(--fb-brand-color)",
      "on-brand": "var(--fb-brand-text-color)",
      border: "var(--fb-border-color)",
      "border-highlight": "var(--fb-border-color-highlight)",
      focus: "var(--fb-focus-color)",
      heading: "var(--fb-heading-color)",
      subheading: "var(--fb-subheading-color)",
      "info-text": "var(--fb-info-text-color)",
      signature: "var(--fb-signature-text-color)",
      "survey-bg": "var(--fb-survey-background-color)",
      "accent-bg": "var(--fb-accent-background-color)",
      "accent-selected-bg": "var(--fb-accent-background-color-selected)",
      placeholder: "var(--fb-placeholder-color)",
      shadow: "var(--fb-shadow-color)",
      "rating-fill": "var(--fb-rating-fill)",
      "rating-focus": "var(--fb-rating-hover)",
      "rating-selected": "var(--fb-rating-selected)",
      "back-button-border": "var(--fb-back-btn-border)",
      "submit-button-border": "var(--fb-submit-btn-border)",
    },
    extend: {
      zIndex: {
        999999: "999999",
      },
    },
  },
  plugins: [],
};
