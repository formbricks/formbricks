import { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "../label";
import { Switch } from "./index";

const meta: Meta<typeof Switch> = {
  title: "UI/Switch",
  component: Switch,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "The **Switch** component provides a toggle control for binary states. It's built on Radix UI and supports all standard switch interactions with customizable styling.",
      },
    },
  },
  argTypes: {
    checked: {
      control: "boolean",
      description: "Controlled checked state of the switch",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 1,
    },
    disabled: {
      control: "boolean",
      description: "Disables the switch interaction",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
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
      order: 1,
    },
    id: {
      control: "text",
      description: "ID for the switch element",
      table: {
        category: "Accessibility",
        type: { summary: "string" },
      },
      order: 1,
    },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  args: {
    id: "default-switch",
  },
  render: (args) => <Switch {...args} />,
  parameters: {
    docs: {
      description: {
        story: "Default switch.",
      },
    },
  },
};

export const DefaultWithLabel: Story = {
  args: {
    id: "switch-with-label",
  },
  render: (args) => (
    <div className="flex items-center space-x-2">
      <Switch {...args} />
      <Label htmlFor="switch-with-label" className="cursor-pointer">
        Toggle setting
      </Label>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Switch with label accompanying it. The label is clickable and properly associated with the switch by the id attribute.",
      },
    },
  },
};

export const WithoutLabel: Story = {
  args: {
    "aria-label": "Toggle feature",
  },
  render: (args) => <Switch {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          "Switch without accompanying label. Make sure to provide an aria-label for accessibility when no visible label is present.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    id: "disabled-switch",
    disabled: true,
  },
  decorators: [
    (Story) => (
      <div className="flex items-center space-x-2">
        <Story />
        <Label htmlFor="disabled-switch" className="cursor-pointer">
          Disabled setting
        </Label>
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Switch in disabled state. Both the switch and label appear dimmed and are non-interactive.",
      },
    },
  },
};

export const RightAligned: Story = {
  args: {
    id: "right-aligned-switch",
  },
  decorators: [
    (Story) => (
      <div className="flex w-64 items-center justify-between rounded-lg border p-4">
        <Label htmlFor="right-aligned-switch" className="cursor-pointer">
          Dark mode
        </Label>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          "Switch positioned on the right side with label on the left, commonly used in settings panels.",
      },
    },
  },
};
