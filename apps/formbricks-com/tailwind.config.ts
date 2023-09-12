import headlessuiPlugin from "@headlessui/tailwindcss";
import typographyPlugin from "@tailwindcss/typography";
import forms from "@tailwindcss/forms";
import { type Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
import typographyStyles from "./typography";

export default {
  trailingSlash: true,
  content: [
    // app content
    "./app/**/*.{js,mjs,jsx,ts,tsx,mdx}", // Note the addition of the `app` directory.
    "./pages/**/*.{js,mjs,jsx,ts,tsx,mdx}",
    "./components/**/*.{js,mjs,jsx,ts,tsx,mdx}",
    "./lib/**/*.{js,mjs,jsx,ts,tsx,mdx}",
    "./mdx/**/*.{js,mjs,jsx,ts,tsx,mdx}",
    // include packages if not transpiling
    "../../packages/ui/components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    fontSize: {
      "2xs": ["0.75rem", { lineHeight: "1.25rem" }],
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
    typography: typographyStyles,
    extend: {
      boxShadow: {
        glow: "0 0 4px rgb(0 0 0 / 0.1)",
      },
      dropShadow: {
        card: "0px 4px 12px rgba(0, 0, 0, 0.5);",
      },
      maxWidth: {
        lg: "33rem",
        "2xl": "40rem",
        "3xl": "50rem",
        "5xl": "66rem",
        "8xl": "88rem",
      },
      colors: {
        brand: {
          DEFAULT: "#00C4B8",
          light: "#00C4B8",
          dark: "#00C4B8",
        },

        black: {
          DEFAULT: "#0F172A",
        },
      },
      fontFamily: {
        sans: ["Poppins", ...defaultTheme.fontFamily.sans],
        display: ["Lexend", ...defaultTheme.fontFamily.sans],
      },
      screens: {
        xs: "430px",
      },
      opacity: {
        1: "0.01",
        2.5: "0.025",
        7.5: "0.075",
        15: "0.15",
      },
    },
  },
  plugins: [typographyPlugin, headlessuiPlugin, forms],
} satisfies Config;
