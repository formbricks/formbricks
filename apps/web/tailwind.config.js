const base = require("../../packages/ui/tailwind.config");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content: [...base.content],
};
