import { base } from "../../packages/tailwind-config/tailwind.config";

/** @type {import('tailwindcss').Config} */
// eslint-disable-next-line no-undef
module.exports = {
  ...base,
  content: [...base.content],
  safelist: [{ pattern: /max-w-./, variants: "sm" }],
  darkMode: "class", // Set dark mode to use the 'class' strategy
};
