import type { Decorator, Meta, StoryContext, StoryObj } from "@storybook/react";
import React from "react";
import { Button } from "./button";

// Styling options for the StylingPlayground story
interface StylingOptions {
  buttonHeight: string;
  buttonWidth: string;
  buttonFontSize: string;
  buttonFontFamily: string;
  buttonFontWeight: string;
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
      options: ["default", "destructive", "outline", "secondary", "ghost", "link", "custom"],
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
const withCSSVariables: Decorator<StoryProps> = (
  Story: React.ComponentType,
  context: StoryContext<StoryProps>
) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Storybook's Decorator type doesn't properly infer args type
  const args = context.args as StoryProps;
  const {
    buttonHeight,
    buttonWidth,
    buttonFontSize,
    buttonFontFamily,
    buttonFontWeight,
    buttonBorderRadius,
    buttonBgColor,
    buttonTextColor,
    buttonPaddingX,
    buttonPaddingY,
  } = args;

  const cssVarStyle: React.CSSProperties & Record<string, string | undefined> = {
    "--fb-button-height": buttonHeight,
    "--fb-button-width": buttonWidth,
    "--fb-button-font-size": buttonFontSize,
    "--fb-button-font-family": buttonFontFamily,
    "--fb-button-font-weight": buttonFontWeight,
    "--fb-button-border-radius": buttonBorderRadius,
    "--fb-button-bg-color": buttonBgColor,
    "--fb-button-text-color": buttonTextColor,
    "--fb-button-padding-x": buttonPaddingX,
    "--fb-button-padding-y": buttonPaddingY,
  };

  return (
    <div style={cssVarStyle}>
      <Story />
    </div>
  );
};

export const StylingPlayground: Story = {
  args: {
    variant: "custom",
    children: "Custom Button",
  },
  argTypes: {
    // Button Styling (CSS Variables) - Only for this story
    buttonHeight: {
      control: "text",
      table: {
        category: "Button Styling",
      },
    },
    buttonWidth: {
      control: "text",
      table: {
        category: "Button Styling",
      },
    },
    buttonFontSize: {
      control: "text",
      table: {
        category: "Button Styling",
      },
    },
    buttonFontFamily: {
      control: "text",
      table: {
        category: "Button Styling",
      },
    },
    buttonFontWeight: {
      control: "text",
      table: {
        category: "Button Styling",
      },
    },
    buttonBorderRadius: {
      control: "text",
      table: {
        category: "Button Styling",
      },
    },
    buttonBgColor: {
      control: "color",
      table: {
        category: "Button Styling",
      },
    },
    buttonTextColor: {
      control: "color",
      table: {
        category: "Button Styling",
      },
    },
    buttonPaddingX: {
      control: "text",
      table: {
        category: "Button Styling",
      },
    },
    buttonPaddingY: {
      control: "text",
      table: {
        category: "Button Styling",
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

export const Custom: Story = {
  args: {
    variant: "custom",
    children: "Custom Button",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Disabled Button",
  },
};
