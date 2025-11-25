import { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { BackButton } from "./back-button";

const meta: Meta<typeof BackButton> = {
  title: "Survey Core/Common/BackButton",
  component: BackButton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha" },
    docs: {
      description: {
        component:
          "The **BackButton** component is used in surveys to allow users to navigate to the previous question. It supports internationalization and custom labels.",
      },
    },
  },
  argTypes: {
    onClick: {
      action: "clicked",
      description: "Click handler function",
      table: {
        category: "Behavior",
        type: { summary: "() => void" },
      },
    },
    backButtonLabel: {
      control: "text",
      description:
        "Custom label for the back button. If not provided, uses the translated 'common.back' key.",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
    },
    tabIndex: {
      control: "number",
      description: "Tab index for keyboard navigation",
      table: {
        category: "Accessibility",
        type: { summary: "number" },
        defaultValue: { summary: "2" },
      },
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
    },
  },
  args: { onClick: fn() },
};

export default meta;
type Story = StoryObj<typeof BackButton>;

export const Default: Story = {
  args: {
    onClick: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: "Default back button using the translated 'common.back' text.",
      },
    },
  },
};

export const CustomLabel: Story = {
  args: {
    onClick: fn(),
    backButtonLabel: "Go Back",
  },
  parameters: {
    docs: {
      description: {
        story: "Back button with a custom label instead of the translated text.",
      },
    },
  },
};

export const CustomStyling: Story = {
  args: {
    onClick: fn(),
    className: "bg-blue-500 hover:bg-blue-600 text-white",
  },
  parameters: {
    docs: {
      description: {
        story: "Back button with custom styling applied via className prop.",
      },
    },
  },
};
