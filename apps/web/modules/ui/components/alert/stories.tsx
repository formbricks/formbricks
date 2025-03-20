import { Meta, StoryObj } from "@storybook/react";
import { LightbulbIcon } from "lucide-react";
import { Alert } from "./index";

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
  tags: ["autodocs"],
  parameters: {
    controls: {
      sort: "requiredFirst",
      exclude: [],
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "error", "warning", "info", "success"],
      description: "Style variant of the alert",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
      order: 1,
    },
    size: {
      control: "select",
      options: ["default", "small"],
      description: "Size of the alert component",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
      order: 2,
    },
    icon: {
      control: "object",
      description: "Custom icon component",
      table: {
        category: "Content",
        type: { summary: "ReactNode" },
      },
      order: 3,
    },
    title: {
      control: "text",
      description: "Title text for the alert",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 4,
    },
    description: {
      control: "text",
      description: "Description text for the alert",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 5,
    },
    button: {
      control: "object",
      description: "Button configuration",
      table: {
        category: "Actions",
        type: { summary: "object" },
      },
      order: 6,
    },
    onClick: {
      action: "clicked",
      description: "Click handler function",
      table: {
        category: "Actions",
        type: { summary: "function" },
      },
      order: 7,
    },
    allowChildren: {
      control: "boolean",
      description: "Whether to allow child components",
      table: {
        category: "Content",
        type: { summary: "boolean" },
      },
      order: 8,
    },
  },
};

export default meta;

type Story = StoryObj<typeof Alert>;

// Basic example with structured props
export const Default: Story = {
  args: {
    variant: "default",
    title: "Alert Title",
    description: "This is an important notification with structured props.",
  },
};

// Basic example with structured props
export const Small: Story = {
  args: {
    size: "small",
    title: "Information Alert",
    description: "This is an important notification with structured props.",
    button: {
      label: "Learn more",
      onClick: () => alert("Button clicked"),
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Use if space is limited or the alert is not the main focus.",
      },
    },
  },
};

// With custom button using structured props
export const withButtonAndIcon: Story = {
  args: {
    icon: <LightbulbIcon />,
    title: "Alert Title",
    description: "This is an important notification with structured props.",
    button: {
      label: "Learn more",
      onClick: () => alert("Button clicked"),
    },
  },
};

// Error variant
export const Error: Story = {
  args: {
    variant: "error",
    title: "Error Alert",
    description: "Your session has expired. Please log in again.",
    button: {
      label: "Log in",
      onClick: () => alert("Button clicked"),
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Only use if the user needs to take immediate action or there is a critical error.",
      },
    },
  },
};

// Error variant
export const Warning: Story = {
  args: {
    variant: "warning",
    title: "Warning Alert",
    description: "You are editing sensitive data. Be cautious",
    button: {
      label: "Proceed",
      onClick: () => alert("Button clicked"),
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Use this to make the user aware of potential issues.",
      },
    },
  },
};

// Complex example with loading state
export const Info: Story = {
  args: {
    variant: "info",
    title: "Info Alert",
    description: "There was an update to your application.",
    button: {
      label: "Refresh",
      onClick: () => {},
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Use this to give contextual information nad support the user.",
      },
    },
  },
};

// Success variant
export const Success: Story = {
  args: {
    variant: "success",
    title: "Success Alert",
    description: "This worked! Please proceed.",
    button: {
      label: "Close",
      onClick: () => alert("Button clicked"),
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Use this to give positive feedback.",
      },
    },
  },
};
