const base = require("../../packages/config-tailwind/tailwind.config");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content: [...base.content],
  theme: {
    extend: {
      keyframes: {
        surveyLoadingAnimation: {
          "0%": { transform: "translateY(50px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        surveyExitAnimation: {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(-50px)", opacity: "0" },
        },
      },
      animation: {
        surveyLoading: "surveyLoadingAnimation 0.5s ease-out forwards",
        surveyExit: "surveyExitAnimation 0.5s ease-out forwards",
      },
    },
  },
};
