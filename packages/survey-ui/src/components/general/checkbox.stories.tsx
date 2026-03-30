import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

const meta: Meta<typeof Checkbox> = {
  title: "UI-package/General/Checkbox",
  component: Checkbox,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A checkbox component built with Radix UI primitives. Supports checked, unchecked, and indeterminate states with full accessibility support.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    checked: {
      control: { type: "boolean" },
      description: "The controlled checked state of the checkbox",
    },
    disabled: {
      control: { type: "boolean" },
      description: "Whether the checkbox is disabled",
    },
    required: {
      control: { type: "boolean" },
      description: "Whether the checkbox is required",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "aria-label": "Checkbox",
  },
};

export const Checked: Story = {
  args: {
    checked: true,
    "aria-label": "Checked checkbox",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    "aria-label": "Disabled checkbox",
  },
};

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    checked: true,
    "aria-label": "Disabled checked checkbox",
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  ),
};

export const WithLabelChecked: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms-checked" checked />
      <Label htmlFor="terms-checked">Accept terms and conditions</Label>
    </div>
  ),
};

export const WithLabelDisabled: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms-disabled" disabled />
      <Label htmlFor="terms-disabled">Accept terms and conditions</Label>
    </div>
  ),
};
