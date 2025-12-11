import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{tsx,ts,jsx,js}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--foreground)",
          muted: "var(--destructive-muted)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--fb-survey-brand-color)",
        brand: {
          DEFAULT: "var(--fb-survey-brand-color)",
          "20": "color-mix(in srgb, var(--fb-survey-brand-color) 20%, white)",
        },
        // Input CSS variables (shorter names)
        "input-bg": "var(--fb-input-bg-color)",
        "input-border": "var(--fb-input-border-color, var(--fb-survey-brand-color))",
        "input-text": "var(--fb-input-color)",
        "input-placeholder": "var(--fb-input-placeholder-color)",
        // Option CSS variables
        "option-bg": "var(--fb-option-bg-color)",
        "option-border": "var(--fb-option-border-color)",
        "option-label": "var(--fb-option-label-color)",
        "option-selected-bg": "color-mix(in srgb, var(--fb-option-bg-color) 90%, black)",
        "option-hover-bg": "color-mix(in srgb, var(--fb-option-bg-color) 90%, black)",
        "input-selected-bg": "color-mix(in srgb, var(--fb-input-bg-color) 90%, black)",
      },
      width: {
        input: "var(--fb-input-width)",
      },
      height: {
        input: "var(--fb-input-height)",
      },
      borderRadius: {
        input: "var(--fb-input-border-radius)",
        option: "var(--fb-option-border-radius)",
      },
      fontSize: {
        input: "var(--fb-input-font-size)",
        option: "var(--fb-option-font-size)",
      },
      fontWeight: {
        "input-weight": "var(--fb-input-font-weight)",
        "option-weight": "var(--fb-option-font-weight)",
      },
      fontFamily: {
        input: "var(--fb-input-font-family)",
        option: "var(--fb-option-font-family)",
      },
      padding: {
        "input-x": "var(--fb-input-padding-x)",
        "input-y": "var(--fb-input-padding-y)",
        "option-x": "var(--fb-option-padding-x)",
        "option-y": "var(--fb-option-padding-y)",
      },
      boxShadow: {
        input: "var(--fb-input-shadow)",
      },
      opacity: {
        "input-placeholder": "var(--fb-input-placeholder-opacity)",
      },
    },
  },
} satisfies Config;
