import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { Button } from "./index";

const meta = {
  title: "ui/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["highlight", "primary", "secondary", "minimal", "warn", "alert"],
    },
    size: { control: "select", options: ["base", "sm", "lg", "fab", "icon"] },
  },
  // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#action-args
  args: { onClick: fn() },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: "Button",
    variant: "primary",
  },
};

export const Secondary: Story = {
  args: {
    children: "Button",
    variant: "secondary",
  },
};

export const Minimal: Story = {
  args: {
    children: "Button",
    variant: "minimal",
  },
};

export const Highlight: Story = {
  args: {
    children: "Button",
    variant: "highlight",
  },
};

export const Warn: Story = {
  args: {
    children: "Button",
    variant: "warn",
  },
};

export const Alert: Story = {
  args: {
    children: "Button",
    variant: "alert",
  },
};

export const Loading: Story = {
  args: {
    children: "Button",
    variant: "primary",
    loading: true,
  },
};
