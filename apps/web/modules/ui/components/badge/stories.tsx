import { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./index";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "The **Badge** component displays small status indicators or labels with different colors and sizes. Use it to highlight important information or show status states.",
      },
    },
  },
  argTypes: {
    type: {
      control: "select",
      options: ["warning", "success", "error", "gray"],
      description: "Color variant of the badge",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "gray" },
      },
      order: 1,
    },
    size: {
      control: "select",
      options: ["tiny", "normal", "large"],
      description: "Size of the badge",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "normal" },
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
    role: {
      control: "text",
      description: "Accessibility role attribute",
      table: {
        category: "Behavior",
        type: { summary: "string" },
      },
      order: 1,
    },
    text: {
      control: "text",
      description: "Badge content text",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 1,
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    text: "Badge",
    type: "gray",
    size: "normal",
  },
};

export const Warning: Story = {
  args: {
    text: "Warning",
    type: "warning",
    size: "normal",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for warnings or actions that need attention.",
      },
    },
  },
};

export const Success: Story = {
  args: {
    text: "Success",
    type: "success",
    size: "normal",
  },
  parameters: {
    docs: {
      description: {
        story: "Use to indicate successful operations or positive states.",
      },
    },
  },
};

export const Destructive: Story = {
  args: {
    text: "Error",
    type: "error",
    size: "normal",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for errors or failed operations.",
      },
    },
  },
};

export const Gray: Story = {
  args: {
    text: "Gray",
    type: "gray",
    size: "normal",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for neutral information or inactive states.",
      },
    },
  },
};

export const Tiny: Story = {
  args: {
    text: "Tiny",
    type: "gray",
    size: "tiny",
  },
  parameters: {
    docs: {
      description: {
        story: "Use when space is very limited or for subtle indicators.",
      },
    },
  },
};

export const Large: Story = {
  args: {
    text: "Large",
    type: "gray",
    size: "large",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for prominent badges or when more visibility is needed.",
      },
    },
  },
};

export const LongText: Story = {
  args: {
    text: "Very Long Badge Text",
    type: "warning",
    size: "normal",
  },
  parameters: {
    docs: {
      description: {
        story: "Badge handles longer text content gracefully.",
      },
    },
  },
};

export const CustomStyling: Story = {
  args: {
    text: "Custom",
    type: "gray",
    size: "normal",
    className: "bg-purple-100 border-purple-200 text-purple-800",
  },
  parameters: {
    docs: {
      description: {
        story: "You can override the default styling with custom CSS classes.",
      },
    },
  },
};

export const WithRole: Story = {
  args: {
    text: "Status",
    type: "success",
    size: "normal",
    role: "status",
  },
  parameters: {
    docs: {
      description: {
        story: "Use role attribute for better accessibility, especially for dynamic status updates.",
      },
    },
  },
};
