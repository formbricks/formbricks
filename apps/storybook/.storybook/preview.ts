import type { Preview } from "@storybook/react-vite";
import React from "react";
import { I18nProvider } from "../../web/lingodotdev/client";
import "../../web/modules/ui/globals.css";

// Create a Storybook-specific Lingodot Dev decorator
const withLingodotDev = (Story: any) => {
  return React.createElement(
    I18nProvider,
    {
      language: "en-US",
      defaultLanguage: "en-US",
    } as any,
    React.createElement(Story)
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [withLingodotDev],
};

export default preview;
