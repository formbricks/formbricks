import type { Preview } from "@storybook/react-vite";
import { TolgeeProvider } from "@tolgee/react";
import React from "react";
import "../../web/modules/ui/globals.css";
import { TolgeeBase } from "../../web/tolgee/shared";

// Create a Storybook-specific Tolgee decorator
const withTolgee = (Story: any) => {
  const tolgee = TolgeeBase().init({
    tagNewKeys: [], // No branch tagging in Storybook
  });

  return React.createElement(
    TolgeeProvider,
    { tolgee, fallback: "Loading", ssr: { language: "en", staticData: {} } },
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
  decorators: [withTolgee],
};

export default preview;
