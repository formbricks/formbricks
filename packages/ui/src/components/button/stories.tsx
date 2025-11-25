import { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Button } from "./index";

const meta: Meta<typeof Button> = {
  title: "UI Package/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "The **Button** component from the UI package provides clickable actions with multiple variants and sizes. It supports loading states, different visual styles, and is built with React and Tailwind CSS.",
      },
    },
  },
  argTypes: {
    loading: {
      control: "boolean",
      description: "Shows loading spinner and disables interaction",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 1,
    },
    disabled: {
      control: "boolean",
      description: "Disables the button interaction",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 2,
    },
    onClick: {
      action: "clicked",
      description: "Click handler function",
      table: {
        category: "Behavior",
        type: { summary: "function" },
      },
      order: 3,
    },
    variant: {
      control: "select",
      options: ["default", "primary", "secondary", "destructive", "outline", "ghost"],
      description: "Visual style variant of the button",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "default" },
      },
      order: 1,
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Size of the button",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "md" },
      },
      order: 2,
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
      order: 3,
    },
    children: {
      control: "text",
      description: "Button content",
      table: {
        category: "Content",
        type: { summary: "React.ReactNode" },
      },
      order: 1,
    },
  },
  args: { onClick: fn() },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: "Button",
    variant: "default",
  },
};

export const Primary: Story = {
  args: {
    children: "Primary Button",
    variant: "primary",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for primary actions that are the main focus of the interface.",
      },
    },
  },
};

export const Secondary: Story = {
  args: {
    children: "Secondary Button",
    variant: "secondary",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for secondary actions that are less important than the primary action.",
      },
    },
  },
};

export const Destructive: Story = {
  args: {
    children: "Delete",
    variant: "destructive",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for actions that are destructive or potentially harmful, like deleting data.",
      },
    },
  },
};

export const Outline: Story = {
  args: {
    children: "Button",
    variant: "outline",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for secondary actions or when you need a button with less visual weight.",
      },
    },
  },
};

export const Ghost: Story = {
  args: {
    children: "Button",
    variant: "ghost",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for subtle actions or when you need minimal visual impact.",
      },
    },
  },
};

export const Small: Story = {
  args: {
    children: "Small Button",
    size: "sm",
  },
};

export const Medium: Story = {
  args: {
    children: "Medium Button",
    size: "md",
  },
};

export const Large: Story = {
  args: {
    children: "Large Button",
    size: "lg",
  },
};

export const Loading: Story = {
  args: {
    children: "Loading...",
    variant: "primary",
    loading: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use to show loading state during async operations. The button becomes disabled and shows a spinner.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    children: "Disabled Button",
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Use when the button action is temporarily unavailable.",
      },
    },
  },
};

export const CustomStyling: Story = {
  args: {
    children: "Custom Button",
    className: "bg-purple-500 hover:bg-purple-600 text-white",
  },
  parameters: {
    docs: {
      description: {
        story: "You can override the default styling with custom CSS classes.",
      },
    },
  },
};
