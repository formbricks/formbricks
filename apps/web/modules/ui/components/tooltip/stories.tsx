import { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./index";

interface StoryOptions {
  side: "top" | "right" | "bottom" | "left";
  delayDuration: number;
  sideOffset: number;
  buttonText: string;
  tooltipText: string;
  className?: string;
}

type TooltipStoryProps = StoryOptions;

const meta: Meta<TooltipStoryProps> = {
  title: "UI/Tooltip",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "The **Tooltip** component provides contextual information in a compact overlay. Use tooltips to explain buttons, provide additional context, or show helpful hints without cluttering the interface.",
      },
    },
  },
  argTypes: {
    tooltipText: {
      control: "text",
      description: "The text content to display in the tooltip",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 1,
    },
    buttonText: {
      control: "text",
      description: "The text to display on the button trigger",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 2,
    },
    side: {
      control: "select",
      options: ["top", "right", "bottom", "left"],
      description: "Side where the tooltip appears relative to the trigger",
      table: {
        category: "Behavior",
        type: { summary: "string" },
        defaultValue: { summary: "top" },
      },
      order: 3,
    },
    delayDuration: {
      control: { type: "number", min: 0, max: 1000, step: 100 },
      description: "Delay in milliseconds before tooltip appears",
      table: {
        category: "Behavior",
        type: { summary: "number" },
        defaultValue: { summary: "700" },
      },
      order: 4,
    },
    sideOffset: {
      control: { type: "number", min: 0, max: 20, step: 1 },
      description: "Distance in pixels from the trigger",
      table: {
        category: "Appearance",
        type: { summary: "number" },
        defaultValue: { summary: "4" },
      },
      order: 5,
    },
    className: {
      control: "text",
      description: "Additional CSS classes for the tooltip content",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
      order: 6,
    },
  },
};

export default meta;
type Story = StoryObj<TooltipStoryProps>;

const renderTooltip = (args: TooltipStoryProps) => {
  const { side, delayDuration, sideOffset, buttonText, tooltipText, className } = args;

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">{buttonText}</Button>
        </TooltipTrigger>
        <TooltipContent side={side} sideOffset={sideOffset} className={className}>
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const Default: Story = {
  render: renderTooltip,
  args: {
    tooltipText: "This is a helpful tooltip",
    buttonText: "Hover me",
    side: "top",
    delayDuration: 0,
    sideOffset: 4,
    className: "",
  },
};

export const WithButton: Story = {
  render: renderTooltip,
  args: {
    tooltipText: "Create a new survey to collect responses",
    buttonText: "Create Survey",
    side: "top",
    delayDuration: 700,
    sideOffset: 4,
    className: "",
  },
  parameters: {
    docs: {
      description: {
        story: "Use tooltips with buttons to provide additional context about the action.",
      },
    },
  },
};

export const BottomPosition: Story = {
  render: renderTooltip,
  args: {
    tooltipText: "This tooltip appears below the button",
    buttonText: "Bottom tooltip",
    side: "bottom",
    delayDuration: 700,
    sideOffset: 8,
    className: "",
  },
  parameters: {
    docs: {
      description: {
        story: "Position tooltips on different sides of the trigger element.",
      },
    },
  },
};

export const NoDelay: Story = {
  render: renderTooltip,
  args: {
    tooltipText: "This tooltip shows immediately",
    buttonText: "Instant tooltip",
    side: "top",
    delayDuration: 0,
    sideOffset: 4,
    className: "",
  },
  parameters: {
    docs: {
      description: {
        story: "Remove delay for immediate tooltip display.",
      },
    },
  },
};

export const LongContent: Story = {
  render: renderTooltip,
  args: {
    tooltipText:
      "This is a very long tooltip content that demonstrates how tooltips handle extended text. It provides comprehensive information that might be needed by users to understand the feature better.",
    buttonText: "Long tooltip",
    side: "top",
    delayDuration: 700,
    sideOffset: 4,
    className: "",
  },
  parameters: {
    docs: {
      description: {
        story: "Tooltips automatically handle longer content and wrap text appropriately.",
      },
    },
  },
};

export const CustomStyling: StoryObj = {
  render: renderTooltip,
  args: {
    tooltipText: "This tooltip has custom styling",
    buttonText: "Custom styling",
    side: "top",
    delayDuration: 700,
    sideOffset: 4,
    className: "bg-blue-900 text-blue-50 border-blue-700",
  },
  parameters: {
    docs: {
      description: {
        story: "Customize the appearance of tooltips with custom CSS classes.",
      },
    },
  },
};
