import { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { type JSX } from "preact";
import { fn } from "storybook/test";
import { Button, type ButtonProps } from "./button";

const meta: Meta<ButtonProps> = {
  title: "Surveys/V5/Button",
  component: Button as any,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "The **Button** component for survey interfaces provides clickable actions with multiple variants and sizes. Built with Preact for optimal performance in embedded survey widgets.",
      },
    },
  },
  argTypes: {
    onClick: {
      action: "clicked",
      description: "Click handler function",
      table: {
        category: "Behavior",
        type: { summary: "function" },
      },
      order: 1,
    },
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
      description: "Visual style variant of the button",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "default" },
      },
      order: 1,
    },
    style: {
      control: "object",
      description: "Inline style object for custom CSS styling",
      table: {
        category: "Appearance",
        type: { summary: "object" },
      },
      order: 4,
    },
  },
  args: { onClick: fn() },
};

export default meta;
type Story = StoryObj<ButtonProps>;

export const Default: Story = {
  args: {
    children: "Submit Response",
    variant: "default",
  },
};

export const Destructive: Story = {
  args: {
    children: "Skip Survey",
    variant: "destructive",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use for actions that are destructive or exit flows, like skipping a survey or canceling progress.",
      },
    },
  },
};

export const Outline: Story = {
  args: {
    children: "Back",
    variant: "outline",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use for secondary actions like navigation or when you need a button with less visual weight than the primary action.",
      },
    },
  },
};

export const Secondary: Story = {
  args: {
    children: "Save Draft",
    variant: "secondary",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for secondary actions that are less important than the primary submit action.",
      },
    },
  },
};

export const Ghost: Story = {
  args: {
    children: "Skip Question",
    variant: "ghost",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for subtle actions or when you need minimal visual impact in the survey flow.",
      },
    },
  },
};

export const Link: Story = {
  args: {
    children: "Learn more",
    variant: "link",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use when you want button functionality but link appearance, like for help text or additional information.",
      },
    },
  },
};

export const Icon: Story = {
  args: {
    children: "→",
  },
  parameters: {
    docs: {
      description: {
        story: "Square button for icon-only actions. Default size for icon buttons.",
      },
    },
  },
};

export const textWithIconOnRight: Story = {
  args: {
    children: (
      <div className="flex items-center gap-2">
        <span>Next</span>
        <ArrowRightIcon className="size-4" />
      </div>
    ),
  },
};

export const textWithIconOnLeft: Story = {
  args: {
    children: (
      <div className="flex items-center gap-2">
        <ArrowLeftIcon className="size-4" />
        <span>Previous</span>
      </div>
    ),
    variant: "secondary",
  },
};

export const Disabled: Story = {
  args: {
    children: "Submit",
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Use when the button action is temporarily unavailable, such as when survey validation fails.",
      },
    },
  },
};

export const InlineStyleWithGradient: Story = {
  args: {
    children: "Gradient Button",
    style: {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      padding: "12px 32px",
      fontSize: "16px",
      fontWeight: "600",
      border: "none",
      cursor: "pointer",
      boxShadow: "0 8px 15px rgba(102, 126, 234, 0.4)",
    } as JSX.CSSProperties,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Inline styles can include complex CSS like gradients, perfect for creating visually striking buttons with custom theming.",
      },
    },
  },
};
