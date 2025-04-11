import { createColorSet, withAccountKitUi } from "@account-kit/react/tailwind";
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";

const colors = require("tailwindcss/colors");

const config = {
  content: [
    // app content
    "./app/**/*.{js,ts,jsx,tsx}", // Note the addition of the `app` directory.
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./modules/**/*.{js,ts,jsx,tsx}",
    // include packages if not transpiling
    "./modules/ui/components/**/*.{ts,tsx}",
    "../../packages/surveys/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        "ping-slow": "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        shake: "shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        fadeIn: "fadeIn 0.2s ease-out",
        fadeOut: "fadeOut 0.2s ease-out",
        surveyLoading: "surveyLoadingAnimation 0.5s ease-out forwards",
        surveyExit: "surveyExitAnimation 0.5s ease-out forwards",
      },
      blur: {
        xxs: "0.33px",
        xs: "2px",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      boxShadow: {
        "card-sm": "0px 0.5px 12px -5px rgba(30,41,59,0.20)",
        "card-md": "0px 1px 25px -10px rgba(30,41,59,0.30)",
        "card-lg": "0px 2px 51px -19px rgba(30,41,59,0.40)",
        "card-xl": "0px 20px 25px -5px rgba(0, 0, 0, 0.10), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)",
      },
      borderRadius: {
        custom: "var(--border-radius)",
      },
      colors: {
        brand: {
          DEFAULT: "#38B5DB",
          light: "#38B5DB",
          dark: "#38B5DB",
        },
        focus: "var(--formbricks-focus, #38B5DB)",
        // error: "rgb(from var(--formbricks-error) r g b / <alpha-value>)",
        brandnew: "var(--formbricks-brand, #38B5DB)",
        primary: {
          DEFAULT: "#0f172a",
          foreground: "#fefefe",
        },
        destructive: {
          DEFAULT: "#FF6B6B", // A softer, coral-like red
          foreground: "#FFF5F5",
        },
        secondary: {
          DEFAULT: "#f1f5f9",
          foreground: "#0f172a",
        },
        accent: {
          DEFAULT: "#f4f6f8", // light gray background
          foreground: "#0f172a", // same as primary default for consistency
        },
        info: {
          DEFAULT: colors.blue[600],
          foreground: colors.blue[900],
          muted: colors.blue[700],
          background: colors.blue[50],
          "background-muted": colors.blue[100],
        },
        warning: {
          DEFAULT: colors.amber[500],
          foreground: colors.amber[900],
          muted: colors.amber[700],
          background: colors.amber[50],
          "background-muted": colors.amber[100],
        },
        success: {
          DEFAULT: colors.green[600],
          foreground: colors.green[900],
          muted: colors.green[700],
          background: colors.green[50],
          "background-muted": colors.green[100],
        },
        error: {
          DEFAULT: colors.red[600],
          foreground: colors.red[900],
          muted: colors.red[700],
          background: colors.red[50],
          "background-muted": colors.red[100],
        },
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
        "survey-shadow": "var(--survey-shadow-color)",
        "accent-bg": "var(--accent-background-color)",
        "accent-selected-bg": "var(--accent-background-color-selected)",
        "input-bg": "var(--input-background-color)",
        "input-bg-selected": "var(--input-background-color-selected)",
        placeholder: "var(--placeholder-color)",
        shadow: "var(--shadow-color)",
        "rating-fill": "var(--rating-fill)",
        "rating-focus": "var(--rating-hover)",
        "rating-selected": "var(--rating-selected)",
        "back-button-border": "var(--back-btn-border)",
        "submit-button-border": "var(--submit-btn-border)",
        "close-button": "var(--close-btn-color)",
        "close-button-focus": "var(--close-btn-hover-color)",
        "calendar-tile": "var(--calendar-tile-color)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        shake: {
          "10%, 90%": {
            transform: "translate3d(-1px, 0, 0)",
          },

          "20%, 80%": {
            transform: "translate3d(2px, 0, 0),",
          },

          "30%, 50%, 70%": {
            transform: "translate3d(-4px, 0, 0)",
          },

          "40%, 60%": {
            transform: "translate3d(4px, 0, 0)",
          },
        },
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        surveyLoadingAnimation: {
          "0%": { transform: "translateY(50px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        surveyExitAnimation: {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(-50px)", opacity: "0" },
        },
      },
      width: {
        "sidebar-expanded": "4rem",
        "sidebar-collapsed": "14rem",
      },
      transitionProperty: {
        width: "width",
      },
      maxWidth: {
        "8xl": "88rem",
      },
      screens: {
        xs: "430px",
      },
      scale: {
        97: "0.97",
      },
      gridTemplateColumns: {
        20: "repeat(20, minmax(0, 1fr))",
      },
    },
  },
  safelist: [{ pattern: /max-w-./, variants: "sm" }],
  darkMode: "class", // Set dark mode to use the 'class' strategy
  plugins: [forms, typography],
};

const accountKitConfig = {
  colors: {
    "btn-primary": createColorSet("#00c4b8", "#00e6ca"),
    "fg-accent-brand": createColorSet("#00c4b8", "#00e6ca"),
  },
};
export default withAccountKitUi(config, accountKitConfig);
