import type { Meta, StoryObj } from "@storybook/react";

import { ButtonV2 } from "./index";

const buttonMeta = {
  title: "Button",
  component: ButtonV2,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["highlight", "primary", "secondary", "minimal", "warn", "alert", "darkCTA"],
    },
    size: { control: "select", options: ["base", "sm", "lg", "fab", "icon"] },
    onClick: { action: "clicked", type: "function" },
  },
} satisfies Meta<typeof ButtonV2>;

export default buttonMeta;
type Story = StoryObj<typeof buttonMeta>;

export const PrimaryStory: Story = {
  name: "Primary",
  args: {
    className: "",
    children: "Button",
    variant: "primary",
  },
};
