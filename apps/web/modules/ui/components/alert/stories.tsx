import { Meta, StoryObj } from "@storybook/react";
import { LightbulbIcon } from "lucide-react";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "./index";

// We'll define the story options separately from the component props
interface StoryOptions {
  title: string;
  description: string;
  showIcon: boolean;
  showActions: boolean;
  actionButtonText: string;
}

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
  // These argTypes are for story controls, not component props
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
        defaultValue: { summary: "default" },
      },
      order: 2,
    },
    title: {
      control: "text",
      description: "Alert title text",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 1,
    },
    description: {
      control: "text",
      description: "Alert description text",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 2,
    },
    showIcon: {
      control: "boolean",
      description: "Whether to show an icon",
      table: {
        category: "Appearance",
        type: { summary: "boolean" },
      },
      order: 4,
    },
    showActions: {
      control: "boolean",
      description: "Whether to show action buttons",
      table: {
        category: "Appearance",
        type: { summary: "boolean" },
      },
      order: 5,
    },
    actionButtonText: {
      control: "text",
      description: "Text for the action button",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 3,
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
  } as any,
};

export default meta;

// Our story type just specifies Alert props plus our story options
type Story = StoryObj<typeof Alert> & { args: StoryOptions };

// Create a common render function to reduce duplication
const renderAlert = (args: any) => {
  // Extract component props
  const { variant = "default", size = "default", className = "" } = args;

  // Extract story content options
  const {
    title = "",
    description = "",
    showIcon = false,
    showActions = false,
    actionButtonText = "",
  } = args as StoryOptions;

  return (
    <Alert variant={variant} size={size} className={className}>
      {showIcon && <LightbulbIcon className="absolute left-4 top-4 h-4 w-4" />}
      <AlertTitle className={showIcon ? "pl-7" : ""}>{title}</AlertTitle>
      {description && <AlertDescription className={showIcon ? "pl-7" : ""}>{description}</AlertDescription>}
      {showActions && <AlertButton onClick={() => alert("Button clicked")}>{actionButtonText}</AlertButton>}
    </Alert>
  );
};

// Basic example with direct props
export const Default: Story = {
  render: renderAlert,
  args: {
    variant: "default",
    title: "Alert Title",
    description: "This is an important notification.",
    showIcon: false,
    showActions: false,
    actionButtonText: "Learn more",
  },
};

// Small size example
export const Small: Story = {
  render: renderAlert,
  args: {
    variant: "default",
    size: "small",
    title: "Information Alert",
    description: "This is an important notification.",
    showIcon: false,
    showActions: true,
    actionButtonText: "Learn more",
  },
  parameters: {
    docs: {
      description: {
        story: "Use if space is limited or the alert is not the main focus.",
      },
    },
  },
};

// With custom icon
export const withButtonAndIcon: Story = {
  render: renderAlert,
  args: {
    variant: "default",
    title: "Alert Title",
    description: "This is an important notification.",
    showIcon: true,
    showActions: true,
    actionButtonText: "Learn more",
  },
};

// Error variant
export const Error: Story = {
  render: renderAlert,
  args: {
    variant: "error",
    title: "Error Alert",
    description: "Your session has expired. Please log in again.",
    showIcon: false,
    showActions: true,
    actionButtonText: "Log in",
  },
  parameters: {
    docs: {
      description: {
        story: "Only use if the user needs to take immediate action or there is a critical error.",
      },
    },
  },
};

// Warning variant
export const Warning: Story = {
  render: renderAlert,
  args: {
    variant: "warning",
    title: "Warning Alert",
    description: "You are editing sensitive data. Be cautious",
    showIcon: false,
    showActions: true,
    actionButtonText: "Proceed",
  },
  parameters: {
    docs: {
      description: {
        story: "Use this to make the user aware of potential issues.",
      },
    },
  },
};

// Info variant
export const Info: Story = {
  render: renderAlert,
  args: {
    variant: "info",
    title: "Info Alert",
    description: "There was an update to your application.",
    showIcon: false,
    showActions: true,
    actionButtonText: "Refresh",
  },
  parameters: {
    docs: {
      description: {
        story: "Use this to give contextual information and support the user.",
      },
    },
  },
};

// Success variant
export const Success: Story = {
  render: renderAlert,
  args: {
    variant: "success",
    title: "Success Alert",
    description: "This worked! Please proceed.",
    showIcon: false,
    showActions: true,
    actionButtonText: "Close",
  },
  parameters: {
    docs: {
      description: {
        story: "Use this to give positive feedback.",
      },
    },
  },
};
