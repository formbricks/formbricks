// src/Label.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./index";

const meta: Meta<typeof Label> = {
  title: "UI/Label",
  component: Label,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
The **Label** component is used to label form fields in your application. 
     `,
      },
    },
  },
  argTypes: {
    className: { control: "text" },
    children: { control: "text" },
  },
};

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
