import { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { NumberStepper } from "./index";

type StoryProps = React.ComponentProps<typeof NumberStepper>;

const meta: Meta<StoryProps> = {
  title: "UI/NumberStepper",
  component: NumberStepper,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: ["value", "onChange"] },
    docs: {
      description: {
        component:
          "The **NumberStepper** is a number field with − and + buttons for precise values like font size, padding, radius or a percentage. ArrowUp/ArrowDown step (Shift for ×10), Enter commits, Escape reverts, and blur clamps to the bounds.",
      },
    },
  },
  argTypes: {
    min: {
      control: "number",
      description: "Lowest allowed value; the − button disables there",
      table: { category: "Behavior", type: { summary: "number" } },
    },
    max: {
      control: "number",
      description: "Highest allowed value; the + button disables there",
      table: { category: "Behavior", type: { summary: "number" } },
    },
    step: {
      control: "number",
      description: "Amount added or removed per press; decimals are rounded to the step's precision",
      table: { category: "Behavior", type: { summary: "number" }, defaultValue: { summary: "1" } },
    },
    disabled: {
      control: "boolean",
      description: "Disables the field and both buttons",
      table: { category: "Behavior", type: { summary: "boolean" }, defaultValue: { summary: "false" } },
    },
    className: {
      control: "text",
      description: "Additional CSS classes for the outer box",
      table: { category: "Appearance", type: { summary: "string" } },
    },
    unit: {
      control: "text",
      description: 'Shown after the number, e.g. "px" or "%"',
      table: { category: "Content", type: { summary: "string" } },
    },
    "aria-label": {
      control: "text",
      description: "The field's name for assistive tech when no visible label points at it",
      table: { category: "Content", type: { summary: "string" } },
    },
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

const StepperWithValue = (args: StoryProps) => {
  const [value, setValue] = useState(args.value);

  return (
    <div className="w-40">
      <NumberStepper {...args} value={value} onChange={setValue} />
    </div>
  );
};

export const Default: Story = {
  render: StepperWithValue,
  args: { value: 16, min: 10, max: 32, unit: "px", "aria-label": "Font size" },
};

export const Disabled: Story = {
  render: StepperWithValue,
  args: { value: 12, unit: "px", disabled: true, "aria-label": "Font size" },
};

export const PercentStep: Story = {
  render: StepperWithValue,
  args: { value: 50, min: 0, max: 100, step: 5, unit: "%", "aria-label": "Offset" },
  parameters: {
    docs: { description: { story: "Steps of 5 between 0 and 100, with a percent unit." } },
  },
};

export const DecimalStep: Story = {
  render: StepperWithValue,
  args: { value: 0.8, min: 0, max: 1, step: 0.05, "aria-label": "Opacity" },
  parameters: {
    docs: { description: { story: "Decimal steps stay exact (0.8 + 0.05 is 0.85, not 0.8500000001)." } },
  },
};

export const AtBounds: Story = {
  render: StepperWithValue,
  args: { value: 2, min: 0, max: 2, "aria-label": "Count" },
  parameters: {
    docs: { description: { story: "At the maximum the + button is disabled; typed values clamp on blur." } },
  },
};
