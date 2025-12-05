import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Button } from "./button";

// Styling options for the StylingPlayground story
interface StylingOptions {
  buttonHeight: string;
  buttonWidth: string;
  buttonFontSize: string;
  buttonBorderRadius: string;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonPaddingX: string;
  buttonPaddingY: string;
}

type ButtonProps = React.ComponentProps<typeof Button>;
type StoryProps = ButtonProps & StylingOptions;

const meta: Meta<StoryProps> = {
  title: "UI-package/General/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
      description: "Visual style variant of the button",
      table: { category: "Component Props" },
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
      description: "Size of the button",
      table: { category: "Component Props" },
    },
    disabled: {
      control: "boolean",
      table: { category: "Component Props" },
    },
    asChild: {
      table: { disable: true },
    },
    children: {
      table: { disable: true },
    },
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args
const withCSSVariables: Decorator<StoryProps> = (Story, context) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Storybook's Decorator type doesn't properly infer args type
  const args = context.args as StoryProps;
  const {
    buttonHeight,
    buttonWidth,
    buttonFontSize,
    buttonBorderRadius,
    buttonBgColor,
    buttonTextColor,
    buttonPaddingX,
    buttonPaddingY,
  } = args;

  const cssVarStyle = {
    "--fb-button-height": buttonHeight,
    "--fb-button-width": buttonWidth,
    "--fb-button-font-size": buttonFontSize,
    "--fb-button-border-radius": buttonBorderRadius,
    "--fb-button-bg-color": buttonBgColor,
    "--fb-button-text-color": buttonTextColor,
    "--fb-button-padding-x": buttonPaddingX,
    "--fb-button-padding-y": buttonPaddingY,
  } as React.CSSProperties;

  return (
    <div style={cssVarStyle}>
      <Story />
    </div>
  );
};

export const StylingPlayground: Story = {
  args: {
    children: "Custom Button",
    // Default styling values
    buttonHeight: "40px",
    buttonWidth: "auto",
    buttonFontSize: "14px",
    buttonBorderRadius: "0.5rem",
    buttonBgColor: "#3b82f6",
    buttonTextColor: "#ffffff",
    buttonPaddingX: "16px",
    buttonPaddingY: "8px",
  },
  argTypes: {
    // Button Styling (CSS Variables) - Only for this story
    buttonHeight: {
      control: "text",
      table: {
        category: "Button Styling",
        defaultValue: { summary: "40px" },
      },
    },
    buttonWidth: {
      control: "text",
      table: {
        category: "Button Styling",
        defaultValue: { summary: "auto" },
      },
    },
    buttonFontSize: {
      control: "text",
      table: {
        category: "Button Styling",
        defaultValue: { summary: "14px" },
      },
    },
    buttonBorderRadius: {
      control: "text",
      table: {
        category: "Button Styling",
        defaultValue: { summary: "var(--fb-border-radius)" },
      },
    },
    buttonBgColor: {
      control: "color",
      table: {
        category: "Button Styling",
        defaultValue: { summary: "var(--fb-brand-color)" },
      },
    },
    buttonTextColor: {
      control: "color",
      table: {
        category: "Button Styling",
        defaultValue: { summary: "var(--fb-brand-text-color)" },
      },
    },
    buttonPaddingX: {
      control: "text",
      table: {
        category: "Button Styling",
        defaultValue: { summary: "16px" },
      },
    },
    buttonPaddingY: {
      control: "text",
      table: {
        category: "Button Styling",
        defaultValue: { summary: "8px" },
      },
    },
  },
  decorators: [withCSSVariables],
};

export const Default: Story = {
  args: {
    children: "Button",
  },
};

export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Delete",
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Button",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Button",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Button",
  },
};

export const Link: Story = {
  args: {
    variant: "link",
    children: "Button",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    children: "Small Button",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    children: "Large Button",
  },
};

export const Icon: Story = {
  args: {
    size: "icon",
    children: "×",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Disabled Button",
  },
};
