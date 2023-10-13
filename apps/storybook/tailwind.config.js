/** @type {import('tailwindcss').Config} */

import base from "../../packages/tailwind-config/tailwind.config";

export default {
  ...base,
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/**/*.{js,ts,jsx,tsx}",
    "!../../packages/ui/node_modules/**/*.{js,ts,jsx,tsx}",
  ],
};
