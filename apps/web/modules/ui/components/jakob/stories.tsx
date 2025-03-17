import type { Meta, StoryObj } from "@storybook/react";
import { AlertButton, AlertDescription, AlertJakob, AlertTitle } from "./index";

interface AlertJakobStoryArgs {
  variant: "default" | "error" | "warning" | "info" | "success";
  size: "default" | "small";
  title: string;
  description: string;
  buttonText?: string;
  showIcon: boolean;
}

const meta: Meta<AlertJakobStoryArgs> = {
  title: "ui/AlertJakob",
  component: AlertJakob,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "error", "warning", "info", "success"],
      description: "The color scheme of the alert",
    },
    size: {
      control: "select",
      options: ["default", "small"],
      description: "Size and padding of the alert",
    },
    title: { control: "text" },
    description: { control: "text" },
    buttonText: { control: "text", description: "Leave empty to hide the button" },
    showIcon: { control: "boolean", description: "Show or hide the icon" },
  },
  args: {
    variant: "default",
    size: "default",
    title: "Heads up!",
    description: "This is an alert message.",
    buttonText: "Learn more",
    showIcon: true,
  },
  render: ({ variant, size, title, description, buttonText, showIcon }) => (
    <AlertJakob
      variant={variant}
      size={size}
      icon={showIcon ? undefined : null}
      button={buttonText ? <AlertButton>{buttonText}</AlertButton> : undefined}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </AlertJakob>
  ),
};

export default meta;

type Story = StoryObj<AlertJakobStoryArgs>;

export const Default: Story = {};

export const Small: Story = {
  args: {
    size: "small",
  },
};

export const Error: Story = {
  args: {
    variant: "error",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
  },
};

export const Info: Story = {
  args: {
    variant: "info",
  },
};

export const Success: Story = {
  args: {
    variant: "success",
  },
};

export const WithoutButton: Story = {
  args: {
    buttonText: "",
  },
};

export const WithoutIcon: Story = {
  args: {
    showIcon: false,
  },
};
