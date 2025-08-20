import { Meta, StoryObj } from "@storybook/react-vite";
import { Logo } from "./index";

interface StoryOptions {
  showLabel: boolean;
}

type StoryProps = React.ComponentProps<typeof Logo> & StoryOptions;

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
          "The **Logo** component displays the Formbricks wordmark logo with scalable SVG graphics. It includes both the brand icon and text, perfect for headers, navigation, and branding areas.",
      },
    },
  },
  argTypes: {
    showLabel: {
      control: "boolean",
      description: "Show descriptive label below logo",
      table: {
        category: "Appearance",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 2,
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
  const { showLabel, ...logoProps } = args;

  return (
    <div className="flex flex-col items-center gap-4">
      <Logo {...logoProps} />
      {showLabel && <p className={`text-sm font-medium`}>Formbricks Wordmark Logo</p>}
    </div>
  );
};

export const Default: Story = {
  render: renderLogoWithOptions,
  args: {
    showLabel: false,
    className: "h-20",
  },
};

export const WithLabel: Story = {
  render: renderLogoWithOptions,
  args: {
    showLabel: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Logo with descriptive label for better context in design documentation.",
      },
    },
  },
};
