/** @type {import('tailwindcss').Config} */
import base from "../../packages/config-tailwind/tailwind.config";

export default {
  ...base,
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "../../packages/ui/**/*.{js,ts,jsx,tsx}"],
};
