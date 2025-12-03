import { type Meta, type StoryObj } from "@storybook/react";
import { Progress } from "./progress";

const meta: Meta<typeof Progress> = {
  title: "UI-package/Progress",
  component: Progress,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    value: {
      control: { type: "range", min: 0, max: 100, step: 1 },
      description: "Progress value (0-100)",
    },
    indicatorStyle: {
      control: { type: "object" },
      description: "Style for the progress indicator",
    },
    trackStyle: {
      control: { type: "object" },
      description: "Style for the progress track",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Progress>;

export const Default: Story = {
  render: (args: React.ComponentProps<typeof Progress>) => (
    <div className="w-64">
      <Progress {...args} />
    </div>
  ),
  args: {
    value: 50,
  },
};

export const Zero: Story = {
  render: (args: React.ComponentProps<typeof Progress>) => (
    <div className="w-64">
      <Progress {...args} />
    </div>
  ),
  args: {
    value: 0,
  },
};

export const Half: Story = {
  render: (args: React.ComponentProps<typeof Progress>) => (
    <div className="w-64">
      <Progress {...args} />
    </div>
  ),
  args: {
    value: 50,
  },
};

export const Complete: Story = {
  render: (args: React.ComponentProps<typeof Progress>) => (
    <div className="w-64">
      <Progress {...args} />
    </div>
  ),
  args: {
    value: 100,
  },
};

export const CustomStyles: Story = {
  render: (args: React.ComponentProps<typeof Progress>) => (
    <div className="w-64">
      <Progress {...args} />
    </div>
  ),
  args: {
    value: 75,
    indicatorStyle: {
      backgroundColor: "green",
    },
    trackStyle: {
      backgroundColor: "black",
      height: "20px",
    },
  },
};
