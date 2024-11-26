import type { Meta, StoryObj } from "@storybook/react";
import { LoadingSpinner } from "./index";

const meta: Meta<typeof LoadingSpinner> = {
  title: "ui/LoadingSpinner",
  component: LoadingSpinner,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
