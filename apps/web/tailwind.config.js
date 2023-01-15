const base = require("../../packages/tailwind-config/tailwind.config");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content: [...base.content],
};
