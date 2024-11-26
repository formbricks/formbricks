/** @type {import('tailwindcss').Config} */
import base from "../web/tailwind.config";

export default {
  ...base,
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "../web/modules/ui/**/*.{js,ts,jsx,tsx}"],
};
