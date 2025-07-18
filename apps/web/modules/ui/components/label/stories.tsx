import { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "./index";

const meta: Meta<typeof Label> = {
  title: "UI/Label",
  component: Label,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "The **Label** component is used to label form fields and provide accessible names for interactive elements. It's built on Radix UI Label primitive and supports all standard label attributes.",
      },
    },
  },
  argTypes: {
    htmlFor: {
      control: "text",
      description: "Associates the label with a form control",
      table: {
        category: "Behavior",
        type: { summary: "string" },
      },
      order: 1,
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
    children: {
      control: "text",
      description: "Label text content",
      table: {
        category: "Content",
        type: { summary: "React.ReactNode" },
      },
      order: 1,
    },
  },
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: {
    children: "Default Label",
  },
};

export const WithInput: Story = {
  render: (args) => (
    <div className="space-y-2">
      <Label {...args} htmlFor="email">
        Email Address
      </Label>
      <input
        id="email"
        type="email"
        placeholder="john@example.com"
        className="w-full rounded-md border border-slate-300 px-3 py-2"
      />
    </div>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          "Use with form inputs to provide accessible labels. The htmlFor attribute should match the input's id.",
      },
    },
  },
};

export const Required: Story = {
  render: (args) => (
    <div className="space-y-2">
      <Label {...args} htmlFor="required-field">
        Required Field <span className="text-red-500">*</span>
      </Label>
      <input
        id="required-field"
        type="text"
        placeholder="Required input"
        className="w-full rounded-md border border-slate-300 px-3 py-2"
        required
      />
    </div>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Use to indicate required form fields with appropriate visual indicators.",
      },
    },
  },
};

export const WithCheckbox: Story = {
  render: (args) => (
    <div className="flex items-center space-x-2">
      <input id="terms" type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600" />
      <Label {...args} htmlFor="terms">
        I agree to the terms and conditions
      </Label>
    </div>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Use with checkboxes and radio buttons for proper accessibility.",
      },
    },
  },
};

export const WithRadio: Story = {
  render: (args) => (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <input id="option1" type="radio" name="options" className="h-4 w-4 border-slate-300 text-blue-600" />
        <Label {...args} htmlFor="option1">
          Option 1
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <input id="option2" type="radio" name="options" className="h-4 w-4 border-slate-300 text-blue-600" />
        <Label {...args} htmlFor="option2">
          Option 2
        </Label>
      </div>
    </div>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Use with radio button groups for proper accessibility and interaction.",
      },
    },
  },
};

export const CustomStyling: Story = {
  args: {
    children: "Custom Styled Label",
    className: "text-lg font-bold text-blue-600",
  },
  parameters: {
    docs: {
      description: {
        story: "You can customize the label appearance with additional CSS classes.",
      },
    },
  },
};

export const Disabled: Story = {
  render: (args) => (
    <div className="space-y-2">
      <Label {...args} htmlFor="disabled-input" className="opacity-50">
        Disabled Field
      </Label>
      <input
        id="disabled-input"
        type="text"
        placeholder="Disabled input"
        className="w-full rounded-md border border-slate-300 px-3 py-2 opacity-50"
        disabled
      />
    </div>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Use with disabled form controls to maintain visual consistency.",
      },
    },
  },
};

export const LongText: Story = {
  args: {
    children:
      "This is a very long label that demonstrates how labels handle extended text content gracefully",
  },
  parameters: {
    docs: {
      description: {
        story: "Shows how the label handles longer text content with proper wrapping.",
      },
    },
  },
};

export const WithHelpText: Story = {
  render: (args) => (
    <div className="space-y-2">
      <Label {...args} htmlFor="password">
        Password
      </Label>
      <input
        id="password"
        type="password"
        placeholder="Enter password"
        className="w-full rounded-md border border-slate-300 px-3 py-2"
      />
      <p className="text-sm text-slate-500">Password must be at least 8 characters long</p>
    </div>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Use with additional help text to provide context and guidance.",
      },
    },
  },
};
