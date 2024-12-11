import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./index";

const meta = {
  title: "ui/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["warning", "success", "error", "gray"],
    },
    size: { control: "select", options: ["tiny", "normal", "large"] },
    className: { control: "text" },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Warning: Story = {
  args: {
    children: "Warning",
    variant: "warning",
    size: "normal",
  },
};

export const Success: Story = {
  args: {
    children: "Success",
    variant: "success",
    size: "normal",
  },
};

export const Error: Story = {
  args: {
    children: "Error",
    variant: "error",
    size: "normal",
  },
};

export const Gray: Story = {
  args: {
    children: "Gray",
    variant: "gray",
    size: "normal",
  },
};

export const LargeWarning: Story = {
  args: {
    children: "Warning",
    variant: "warning",
    size: "large",
  },
};

export const LargeSuccess: Story = {
  args: {
    children: "Success",
    variant: "success",
    size: "large",
  },
};

export const LargeError: Story = {
  args: {
    children: "Error",
    variant: "error",
    size: "large",
  },
};

export const LargeGray: Story = {
  args: {
    children: "Gray",
    variant: "gray",
    size: "large",
  },
};

export const TinyWarning: Story = {
  args: {
    children: "Warning",
    variant: "warning",
    size: "tiny",
  },
};

export const TinySuccess: Story = {
  args: {
    children: "Success",
    variant: "success",
    size: "tiny",
  },
};

export const TinyError: Story = {
  args: {
    children: "Error",
    variant: "error",
    size: "tiny",
  },
};

export const TinyGray: Story = {
  args: {
    children: "Gray",
    variant: "gray",
    size: "tiny",
  },
};
