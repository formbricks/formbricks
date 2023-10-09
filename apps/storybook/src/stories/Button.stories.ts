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
    // className: "text-slate-600 hover:text-slate-500 bg-slate-200 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-1  focus:bg-slate-300 focus:ring-neutral-500",
    children: "Button",
    variant: "highlight",
  },
};
