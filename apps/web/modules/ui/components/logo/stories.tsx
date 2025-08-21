import { Meta, StoryObj } from "@storybook/react-vite";
import { Logo } from "./index";

type StoryProps = React.ComponentProps<typeof Logo>;

const meta: Meta<StoryProps> = {
  title: "UI/Logo",
  component: Logo,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "** Logo ** renders the Formbricks brand as scalable SVG.It supports two variants('image' and 'wordmark') and is suitable for headers, navigation, and other branding areas.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["image", "wordmark"],
      description: "The variant of the logo to display",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "wordmark" },
      },
      order: 1,
    },
    className: {
      control: "text",
      description: "Additional CSS classes for styling",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
      order: 1,
    },
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

const renderLogoWithOptions = (args: StoryProps) => {
  const { ...logoProps } = args;

  return <Logo {...logoProps} />;
};

export const Default: Story = {
  render: renderLogoWithOptions,
  args: {
    className: "h-20",
  },
};

export const Image: Story = {
  render: renderLogoWithOptions,
  args: {
    className: "h-20",
    variant: "image",
  },
};

export const Wordmark: Story = {
  render: renderLogoWithOptions,
  args: {
    className: "h-20",
    variant: "wordmark",
  },
};
