/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  important: "#date-picker-root",
  corePlugins: {
    preflight: false,
  },
};
