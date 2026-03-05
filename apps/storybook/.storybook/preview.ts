import type { Preview } from "@storybook/react-vite";
import React from "react";
import "../../../packages/survey-ui/src/styles/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      expanded: true,
    },
    backgrounds: {
      default: "light",
    },
  },
  decorators: [
    (Story) =>
      React.createElement(
        "div",
        {
          id: "fbjs",
          className: "w-full h-full min-h-screen p-4 bg-background font-sans antialiased text-foreground",
        },
        React.createElement(Story)
      ),
  ],
};

export default preview;
