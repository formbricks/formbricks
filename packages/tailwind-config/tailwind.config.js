module.exports = {
  content: [
    // app content
    "./app/**/*.{js,ts,jsx,tsx}", // Note the addition of the `app` directory.
    "./pages/**/*.{js,ts,jsx,tsx}",
    // include packages if not transpiling
    "../../packages/ui/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        "ping-slow": "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        shake: "shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      boxShadow: {
        "brand-shadow-sm": "3px 3px #0381782A",
        "brand-shadow-base": "4px 4px #0381782A",
        "brand-shadow-lg": "6px 6px #0381782A",
        "focus-shadow": "0px 0px 10px 0px red",
      },
      colors: {
        brand: {
          DEFAULT: "#00E6CA",
          light: "#00E6CA",
          dark: "#00C4B8",
        },
        focus: "var(--formbricks-focus, #1982fc)",
        error: "var(--formbricks-error, #d13a3a)",
        brandnew: "var(--formbricks-brand, #038178)",
        borderColor: {
          primary: "var(--formbricks-border-primary, #e0e0e0)",
          secondary: "var(--formbricks-border-secondary, #0f172a)",
          disabled: "var(--formbricks-border-disabled, #ececec)",
          error: "var(--formbricks-error, #d13a3a)",
        },
        labelColor: {
          primary: "var(--formbricks-label-primary, #0f172a)",
          secondary: "var(--formbricks-label-secondary, #384258)",
          disabled: "var(--formbricks-label-disabled, #bdbdbd)",
          error: "var(--formbricks-error, #d13a3a)",
        },
        fill: {
          primary: "var(--formbricks-fill-primary, #fefefe)",
          secondary: "var(--formbricks-fill-secondary, #0f172a)",
          disabled: "var(--formbricks-fill-disabled, #e0e0e0)",
          error: "var(--formbricks-error, #d13a3a)",
        },
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
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
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
