const base = require("../../packages/tailwind-config/tailwind.config");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content: [...base.content],
  darkMode: "class", // Set dark mode to use the 'class' strategy
};
