import { type Meta, type StoryObj } from "@storybook/react";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

const meta: Meta<typeof Alert> = {
  title: "UI-package/General/Alert",
  component: Alert,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive"],
      description: "Style variant of the alert",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  render: () => (
    <Alert>
      <AlertTitle>Alert Title</AlertTitle>
      <AlertDescription>This is a default alert message.</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Something went wrong. Please try again.</AlertDescription>
    </Alert>
  ),
};

export const DestructiveWithIcon: Story = {
  render: () => (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Something went wrong. Please try again.</AlertDescription>
    </Alert>
  ),
};

export const WithTitleOnly: Story = {
  render: () => (
    <Alert>
      <AlertTitle>Important Notice</AlertTitle>
    </Alert>
  ),
};

export const WithDescriptionOnly: Story = {
  render: () => (
    <Alert>
      <AlertDescription>This alert only has a description.</AlertDescription>
    </Alert>
  ),
};
