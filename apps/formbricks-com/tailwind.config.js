const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],
      sm: ["0.875rem", { lineHeight: "1.5rem" }],
      base: ["1rem", { lineHeight: "2rem" }],
      lg: ["1.125rem", { lineHeight: "1.75rem" }],
      xl: ["1.25rem", { lineHeight: "2rem" }],
      "2xl": ["1.5rem", { lineHeight: "2.5rem" }],
      "3xl": ["2rem", { lineHeight: "2.5rem" }],
      "4xl": ["2.5rem", { lineHeight: "3rem" }],
      "5xl": ["3rem", { lineHeight: "3.5rem" }],
      "6xl": ["3.75rem", { lineHeight: "1" }],
      "7xl": ["4.5rem", { lineHeight: "1" }],
      "8xl": ["6rem", { lineHeight: "1" }],
      "9xl": ["8rem", { lineHeight: "1" }],
    },

    extend: {
      colors: {
        teal: {
          DEFAULT: "#00E5CA",
          50: "#9EFFF4",
          100: "#89FFF1",
          200: "#60FFEC",
          300: "#38FFE7",
          400: "#0FFFE3",
          500: "#00E5CA",
          600: "#0EDAC2",
          700: "#007567",
          800: "#003D36",
          900: "#000504",
        },

        black: {
          DEFAULT: "#000A1C",
        },

        blue: {
          DEFAULT: "#002941",
          50: "#f5f7fa",
          100: "#eaeef4",
          200: "#d3dde7",
          300: "#a9bed0",
          400: "#7a9bb6",
          500: "#597d9e",
          600: "#466483",
          700: "#39516b",
          800: "#002941",
          900: "#001E30",
        },

        gray: {
          DEFAULT: "#647176",
          50: "#f5f7f9",
          100: "#e5eaef",
          200: "#ccd2d5",
          300: "#a9b2b7",
          400: "#7f8c91",
          500: "#647176",
          600: "#576167",
          700: "#495055",
          800: "#414649",
          900: "#393d40",
        },
      },

      fontFamily: {
        sans: ["Poppins", ...defaultTheme.fontFamily.sans],
        display: ["Lexend", ...defaultTheme.fontFamily.sans],
      },
      maxWidth: {
        "8xl": "88rem",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
