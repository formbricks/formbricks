import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./index";

const meta = {
  title: "ui/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    type: {
      control: "select",
      options: ["warning", "success", "error", "gray"],
    },
    size: { control: "select", options: ["small", "normal", "large"] },
    className: { control: "text" },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Warning: Story = {
  args: {
    text: "Warning",
    type: "warning",
    size: "normal",
  },
};

export const Success: Story = {
  args: {
    text: "Success",
    type: "success",
    size: "normal",
  },
};

export const Error: Story = {
  args: {
    text: "Error",
    type: "error",
    size: "normal",
  },
};

export const Gray: Story = {
  args: {
    text: "Gray",
    type: "gray",
    size: "normal",
  },
};

export const LargeWarning: Story = {
  args: {
    text: "Warning",
    type: "warning",
    size: "large",
  },
};

export const LargeSuccess: Story = {
  args: {
    text: "Success",
    type: "success",
    size: "large",
  },
};

export const LargeError: Story = {
  args: {
    text: "Error",
    type: "error",
    size: "large",
  },
};

export const LargeGray: Story = {
  args: {
    text: "Gray",
    type: "gray",
    size: "large",
  },
};

export const TinyWarning: Story = {
  args: {
    text: "Warning",
    type: "warning",
    size: "tiny",
  },
};

export const TinySuccess: Story = {
  args: {
    text: "Success",
    type: "success",
    size: "tiny",
  },
};

export const TinyError: Story = {
  args: {
    text: "Error",
    type: "error",
    size: "tiny",
  },
};

export const TinyGray: Story = {
  args: {
    text: "Gray",
    type: "gray",
    size: "tiny",
  },
};
