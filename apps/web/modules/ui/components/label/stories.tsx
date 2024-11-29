import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./index";

const meta = {
  title: "ui/Label",
  component: Label,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
The **Label** component is used to label the form fields. 
     `,
      },
    },
  },
  argTypes: {
    className: { control: "text" },
    children: { control: "text" },
  },
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Default Label",
  },
};

export const CustomClass: Story = {
  args: {
    children: "Label with Custom Class",
    className: "text-red-500",
  },
};
