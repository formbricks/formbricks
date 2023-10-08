import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@formbricks/ui";

const meta = {
  title: "Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["highlight", "primary", "secondary", "minimal", "warn", "alert", "darkCTA"],
    },
    size: { control: "select", options: ["base", "sm", "lg", "fab", "icon"] },
    onClick: { action: "clicked", type: "function" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    className: "text-slate-400",
    children: "Button",
  },
};
