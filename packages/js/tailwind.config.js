/** @type {import('tailwindcss').Config} */
module.exports = {
  important: "#fbjs",
  darkMode: "class",
  corePlugins: {
    preflight: false,
  },
  content: ["./src/**/*.{tsx,ts,jsx,js}"],
  theme: {
    extend: {
      zIndex: {
        '999999': '999999',
      }
    },
  },
  prefix: "fb-",
  plugins: [],
};
