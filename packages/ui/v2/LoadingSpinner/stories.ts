// src/LoadingSpinner.stories.jsx
import type { Meta, StoryObj } from "@storybook/react";
import { LoadingSpinner } from "./index";

const meta: Meta<typeof LoadingSpinner> = {
  title: "ui/LoadingSpinner",
  component: LoadingSpinner,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    size: { control: "select", options: ["small", "medium", "large"] },
    color: { control: "color" },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: "medium",
    color: "text-slate-700",
  },
};

export const SmallSpinner: Story = {
  args: {
    size: "small",
    color: "text-slate-700",
  },
};

export const LargeSpinner: Story = {
  args: {
    size: "large",
    color: "text-slate-700",
  },
};

export const CustomColor: Story = {
  args: {
    size: "medium",
    color: "#ff5733",
  },
};
