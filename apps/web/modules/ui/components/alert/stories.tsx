import type { Meta, StoryObj } from "@storybook/react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./index";

const meta = {
  title: "ui/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "radio",
      options: ["default", "error"],
    },
  },
  args: {
    variant: "default",
  },
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>This is an alert</AlertTitle>
      <AlertDescription>This is a description</AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Error: Story = {
  args: {
    variant: "error",
  },
};

export const WithIcon: Story = {
  args: {
    variant: "error",
  },
  render: (args) => (
    <Alert {...args}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>This is an alert</AlertTitle>
      <AlertDescription>This is a description</AlertDescription>
    </Alert>
  ),
};
