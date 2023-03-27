/** @type {import('tailwindcss').Config} */
module.exports = {
  important: "#fbjs",
  corePlugins: {
    preflight: false,
  },
  content: ["./src/**/*.{tsx,ts,jsx,js}"],
  theme: {
    extend: {},
  },
  prefix: "fb-",
  plugins: [],
};
