import type { Preview } from "@storybook/react-vite";
import React from "react";
import { I18nProvider as SurveyCoreI18nProvider } from "../../../packages/survey-core/src/components/i18n/provider";
import { I18nProvider as WebI18nProvider } from "../../web/lingodotdev/client";
import "../../web/modules/ui/globals.css";

// Create a Storybook-specific Lingodot Dev decorator for web components
const withLingodotDev = (Story: any) => {
  return React.createElement(
    WebI18nProvider,
    {
      language: "en-US",
      defaultLanguage: "en-US",
    } as any,
    React.createElement(Story)
  );
};

// Create an i18n decorator for survey-core components
const withSurveyCoreI18n = (Story: any) => {
  return React.createElement(
    SurveyCoreI18nProvider,
    {
      language: "en",
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
  decorators: [withLingodotDev, withSurveyCoreI18n],
};

export default preview;
