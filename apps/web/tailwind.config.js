const base = require("../../packages/config-tailwind/tailwind.config");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content: [...base.content],
};
