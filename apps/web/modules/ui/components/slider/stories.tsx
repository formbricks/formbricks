import { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Slider } from "./index";

type StoryProps = React.ComponentProps<typeof Slider>;

const meta: Meta<StoryProps> = {
  title: "UI/Slider",
  component: Slider,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: ["value", "min", "max"] },
    docs: {
      description: {
        component:
          "The **Slider** component provides an intuitive way for users to select a value or range from a continuous set of values, commonly used in survey questions for rating scales or numeric input.",
      },
    },
  },
  argTypes: {
    disabled: {
      control: "boolean",
      description: "Disables the slider interaction",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    step: {
      control: "number",
      description: "The stepping interval between values",
      table: {
        category: "Behavior",
        type: { summary: "number" },
        defaultValue: { summary: "1" },
      },
    },
    className: {
      control: "text",
      description: "Additional CSS classes for styling",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "" },
      },
    },
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

// Interactive component wrapper to show current value
const SliderWithValue = (args: StoryProps) => {
  const [value, setValue] = useState(args.value || [50]);

  return (
    <div className="w-80 space-y-4">
      <Slider {...args} value={value} onValueChange={setValue} />
    </div>
  );
};

export const Default: Story = {
  render: SliderWithValue,
  args: {
    min: 0,
    max: 100,
    step: 1,
    value: [50],
  },
};

export const Disabled: Story = {
  render: SliderWithValue,
  args: {
    min: 0,
    max: 100,
    step: 1,
    value: [30],
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Disabled state for when the slider should not be interactive.",
      },
    },
  },
};

export const CustomStyling: Story = {
  render: SliderWithValue,
  args: {
    min: 0,
    max: 100,
    step: 1,
    value: [60],
    className: "w-96",
  },
  parameters: {
    docs: {
      description: {
        story: "Example with custom width styling applied to the slider.",
      },
    },
  },
};
