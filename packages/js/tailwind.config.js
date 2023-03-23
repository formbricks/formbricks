/** @type {import('tailwindcss').Config} */
module.exports = {
  important: true,
  corePlugins: {
    preflight: false,
  },
  content: ["./src/**/*.{tsx,ts,jsx,js}"],
  theme: {
    extend: {},
  },
  prefix: "fb-",
  plugins: [require("./disable_preflight/tailwindSelectivePreflight.js")],
};
