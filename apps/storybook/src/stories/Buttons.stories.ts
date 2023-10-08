import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@formbricks/ui";

const meta = {
  title: "Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select" },
    onClick: { action: "clicked", type: "function" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: "secondary",
    children: "Button",
  },
};
