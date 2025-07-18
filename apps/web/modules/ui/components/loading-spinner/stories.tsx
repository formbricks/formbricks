import { Meta, StoryObj } from "@storybook/react-vite";
import { LoadingSpinner } from "./index";

const meta: Meta<typeof LoadingSpinner> = {
  title: "UI/LoadingSpinner",
  component: LoadingSpinner,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "The **LoadingSpinner** component displays an animated spinner to indicate loading states. It's centered within its container and can be customized with different sizes and colors.",
      },
    },
  },
  argTypes: {
    className: {
      control: "text",
      description: "Additional CSS classes for styling the spinner",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "h-6 w-6" },
      },
      order: 1,
    },
  },
};

export default meta;
type Story = StoryObj<typeof LoadingSpinner>;

export const Default: Story = {
  args: {},
};

export const Small: Story = {
  args: {
    className: "h-4 w-4",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for small loading indicators or when space is limited.",
      },
    },
  },
};

export const Large: Story = {
  args: {
    className: "h-10 w-10",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for prominent loading states or when more visibility is needed.",
      },
    },
  },
};

export const ExtraLarge: Story = {
  args: {
    className: "h-16 w-16",
  },
  parameters: {
    docs: {
      description: {
        story: "Use for full-page loading states or very prominent loading indicators.",
      },
    },
  },
};

export const ColorVariants: Story = {
  args: {
    className: "h-8 w-8 text-blue-500",
  },
  parameters: {
    docs: {
      description: {
        story: "You can customize the color using text color classes.",
      },
    },
  },
};

export const SlowAnimation: Story = {
  args: {
    className: "h-8 w-8 animate-spin animate-duration-2000",
  },
  parameters: {
    docs: {
      description: {
        story: "You can customize the animation speed with Tailwind animation classes.",
      },
    },
  },
};

export const WithCustomStyles: Story = {
  args: {
    className: "h-12 w-12 text-green-600 drop-shadow-lg",
  },
  parameters: {
    docs: {
      description: {
        story: "Combine multiple utility classes for custom styling effects.",
      },
    },
  },
};
