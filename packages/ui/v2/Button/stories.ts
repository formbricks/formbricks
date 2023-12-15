import type { Meta, StoryObj } from "@storybook/react";

import { ButtonV2 } from "./index";

const meta = {
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

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    className: "",
    children: "Button",
    variant: "secondary",
  },
};
