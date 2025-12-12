/** @type {import('tailwindcss').Config} */
import base from "../web/tailwind.config";
import surveyUi from "../../packages/survey-ui/tailwind.config";

export default {
  ...base,
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../web/modules/ui/**/*.{js,ts,jsx,tsx}",
    "../../packages/survey-ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    ...base.theme,
    extend: {
      ...base.theme?.extend,
      ...surveyUi.theme?.extend,
    },
  },
};
