import type { Config } from "tailwindcss";

function getForeground(color: string) {
  // simple luminance check
  const rgb = color.match(/\w\w/g)?.map((x) => Number.parseInt(x, 16)) ?? [0, 0, 0];
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export default {
  darkMode: "class",
  // Scope all utilities to #fbjs when used in surveys package
  // This ensures proper specificity and prevents conflicts with preflight CSS
  important: "#fbjs",
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
          DEFAULT: "var(--fb-accent-background-color)",
          selected: "var(--fb-accent-background-color-selected)",
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
          foreground: getForeground("var(--fb-survey-brand-color)"),
        },
        // Input CSS variables (shorter names)
        "input-bg": "var(--fb-input-bg-color)",
        "input-border": "var(--fb-input-border-color, var(--fb-survey-brand-color))",
        "input-text": "var(--fb-input-text-color)",
        "input-placeholder": "var(--fb-input-placeholder-color)",
        // Option CSS variables
        "option-bg": "var(--fb-option-bg-color)",
        "option-border":
          "var(--fb-option-border-color, color-mix(in srgb, var(--fb-option-bg-color) 95%, black 5%))",
        "option-label": "var(--fb-option-label-color)",
        "option-selected-bg": "color-mix(in srgb, var(--fb-option-bg-color) 95%, black)",
        "option-hover-bg": "color-mix(in srgb, var(--fb-option-bg-color) 95%, black)",
        "input-selected-bg": "color-mix(in srgb, var(--fb-input-bg-color) 95%, black)",
        // Button CSS variables
        "button-bg": "var(--fb-button-bg-color)",
        "button-text": "var(--fb-button-text-color)",
      },
      width: {
        input: "var(--fb-input-width)",
        button: "var(--fb-button-width)",
      },
      height: {
        input: "var(--fb-input-height)",
        button: "var(--fb-button-height)",
      },
      borderRadius: {
        input: "var(--fb-input-border-radius)",
        option: "var(--fb-option-border-radius)",
        button: "var(--fb-button-border-radius)",
      },
      fontSize: {
        input: "var(--fb-input-font-size)",
        option: "var(--fb-option-font-size)",
        button: "var(--fb-button-font-size)",
      },
      fontWeight: {
        "input-weight": "var(--fb-input-font-weight)",
        "option-weight": "var(--fb-option-font-weight)",
        "button-weight": "var(--fb-button-font-weight)",
      },
      fontFamily: {
        input: "var(--fb-input-font-family)",
        option: "var(--fb-option-font-family)",
        button: "var(--fb-button-font-family)",
      },
      padding: {
        "input-x": "var(--fb-input-padding-x)",
        "input-y": "var(--fb-input-padding-y)",
        "option-x": "var(--fb-option-padding-x)",
        "option-y": "var(--fb-option-padding-y)",
        "button-x": "var(--fb-button-padding-x)",
        "button-y": "var(--fb-button-padding-y)",
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
