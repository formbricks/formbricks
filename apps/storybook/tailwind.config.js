/** @type {import('tailwindcss').Config} */
import surveyUi from "../../packages/survey-ui/tailwind.config";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/survey-ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      ...surveyUi.theme?.extend,
    },
  },
};
