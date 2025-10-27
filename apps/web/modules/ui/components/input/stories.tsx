import { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./index";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "The **Input** component is a versatile form input field that supports all standard HTML input attributes. It includes visual indicators for invalid states and supports various input types with consistent styling.",
      },
    },
  },
  argTypes: {
    isInvalid: {
      control: "boolean",
      description: "Shows invalid state with red border",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 1,
    },
    disabled: {
      control: "boolean",
      description: "Disables the input field",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 2,
    },
    required: {
      control: "boolean",
      description: "Makes the input required",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 3,
    },
    readOnly: {
      control: "boolean",
      description: "Makes the input read-only",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 4,
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
      order: 1,
    },
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "tel", "url", "search"],
      description: "Input type",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "text" },
      },
      order: 2,
    },
    placeholder: {
      control: "text",
      description: "Placeholder text",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 1,
    },
    value: {
      control: "text",
      description: "Input value",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 2,
    },
    defaultValue: {
      control: "text",
      description: "Default input value",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 3,
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Enter text",
  },
};

export const WithValue: Story = {
  args: {
    value: "Sample text",
    placeholder: "Enter text",
  },
  parameters: {
    docs: {
      description: {
        story: "Use when you need to display a pre-filled value.",
      },
    },
  },
};

export const Invalid: Story = {
  args: {
    isInvalid: true,
    placeholder: "Invalid input",
    value: "Invalid value",
  },
  parameters: {
    docs: {
      description: {
        story: "Use to show validation errors with red border styling.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: "Disabled input",
    value: "Cannot edit this",
  },
  parameters: {
    docs: {
      description: {
        story: "Use when the input should not be editable.",
      },
    },
  },
};

export const ReadOnly: Story = {
  args: {
    readOnly: true,
    value: "Read-only value",
    placeholder: "Read-only input",
  },
  parameters: {
    docs: {
      description: {
        story: "Use when you want to display data that cannot be edited but can be selected.",
      },
    },
  },
};

export const Required: Story = {
  args: {
    required: true,
    placeholder: "Required field *",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for mandatory form fields.",
      },
    },
  },
};

export const Password: Story = {
  args: {
    type: "password",
    placeholder: "Enter password",
    value: "secretpassword",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for password input fields with hidden text.",
      },
    },
  },
};

export const Email: Story = {
  args: {
    type: "email",
    placeholder: "john.doe@example.com",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for email input with built-in validation.",
      },
    },
  },
};

export const NumberInput: Story = {
  args: {
    type: "number",
    placeholder: "Enter number",
    min: 0,
    max: 100,
  },
  parameters: {
    docs: {
      description: {
        story: "Use for numeric input with optional min/max validation.",
      },
    },
  },
};

export const Search: Story = {
  args: {
    type: "search",
    placeholder: "Search...",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for search input fields with search-specific styling.",
      },
    },
  },
};

export const WithCustomStyling: Story = {
  args: {
    className: "rounded-lg bg-slate-50 text-base border-2 border-blue-300 focus:border-blue-500",
    placeholder: "Custom styled input",
  },
  parameters: {
    docs: {
      description: {
        story: "You can customize the appearance with additional CSS classes.",
      },
    },
  },
};

export const LongText: Story = {
  args: {
    placeholder:
      "This is a very long placeholder text that demonstrates how the input handles overflow content gracefully",
    value: "This is a very long input value that shows how the text scrolls within the input field",
  },
  parameters: {
    docs: {
      description: {
        story: "Shows how the input handles long content with scrolling.",
      },
    },
  },
};
