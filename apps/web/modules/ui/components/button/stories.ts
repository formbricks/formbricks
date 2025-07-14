import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
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
      options: ["outline", "default", "secondary", "ghost", "destructive", "link"],
    },
    size: { control: "select", options: ["sm", "lg", "fab", "icon"] },
  },
  // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#action-args
  args: { onClick: fn() },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: "Button",
    variant: "default",
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
    variant: "ghost",
  },
};

export const Warn: Story = {
  args: {
    children: "Button",
    variant: "destructive",
  },
};

export const Loading: Story = {
  args: {
    children: "Button",
    variant: "default",
    loading: true,
  },
};
