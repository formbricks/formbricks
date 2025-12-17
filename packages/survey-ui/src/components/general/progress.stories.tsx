import type { Decorator, Meta, StoryContext, StoryObj } from "@storybook/react";
import React from "react";
import { Progress, type ProgressProps } from "./progress";

// Styling options for the StylingPlayground story
interface StylingOptions {
  trackHeight: string;
  trackBgColor: string;
  trackBorderRadius: string;
  indicatorBgColor: string;
  indicatorBorderRadius: string;
}

type StoryProps = ProgressProps & Partial<StylingOptions> & Record<string, unknown>;

const meta: Meta<StoryProps> = {
  title: "UI-package/General/Progress",
  component: Progress,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    value: {
      control: { type: "range", min: 0, max: 100, step: 1 },
      description: "Progress value (0-100)",
      table: { category: "Component Props" },
    },
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args
const withCSSVariables: Decorator<StoryProps> = (
  Story: React.ComponentType,
  context: StoryContext<StoryProps>
) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Storybook's Decorator type doesn't properly infer args type
  const args = context.args as StoryProps;
  const { trackHeight, trackBgColor, trackBorderRadius, indicatorBgColor, indicatorBorderRadius } = args;

  const cssVarStyle: React.CSSProperties & Record<string, string | undefined> = {
    "--fb-progress-track-height": trackHeight,
    "--fb-progress-track-bg-color": trackBgColor,
    "--fb-progress-track-border-radius": trackBorderRadius,
    "--fb-progress-indicator-bg-color": indicatorBgColor,
    "--fb-progress-indicator-border-radius": indicatorBorderRadius,
  };

  return (
    <div style={cssVarStyle}>
      <Story />
    </div>
  );
};

export const Default: Story = {
  render: (args: StoryProps) => (
    <div className="w-64">
      <Progress {...args} />
    </div>
  ),
  args: {
    value: 50,
  },
};

export const Zero: Story = {
  render: (args: StoryProps) => (
    <div className="w-64">
      <Progress {...args} />
    </div>
  ),
  args: {
    value: 0,
  },
};

export const Half: Story = {
  render: (args: StoryProps) => (
    <div className="w-64">
      <Progress {...args} />
    </div>
  ),
  args: {
    value: 50,
  },
};

export const Complete: Story = {
  render: (args: StoryProps) => (
    <div className="w-64">
      <Progress {...args} />
    </div>
  ),
  args: {
    value: 100,
  },
};

export const CustomStyles: Story = {
  render: (args: StoryProps) => (
    <div className="w-64">
      <Progress {...args} />
    </div>
  ),
  args: {
    value: 75,
    trackHeight: "1.25rem",
    trackBgColor: "hsl(0 0% 0% / 0.3)",
    trackBorderRadius: "0.75rem",
    indicatorBgColor: "hsl(142 76% 36%)",
    indicatorBorderRadius: "0.75rem",
  },
  argTypes: {
    trackHeight: {
      control: "text",
      table: {
        category: "Progress Styling",
        defaultValue: { summary: "0.5rem" },
      },
    },
    trackBgColor: {
      control: "color",
      table: {
        category: "Progress Styling",
        defaultValue: { summary: "hsl(222.2 47.4% 11.2% / 0.2)" },
      },
    },
    trackBorderRadius: {
      control: "text",
      table: {
        category: "Progress Styling",
        defaultValue: { summary: "var(--radius)" },
      },
    },
    indicatorBgColor: {
      control: "color",
      table: {
        category: "Progress Styling",
        defaultValue: { summary: "hsl(222.2 47.4% 11.2%)" },
      },
    },
    indicatorBorderRadius: {
      control: "text",
      table: {
        category: "Progress Styling",
        defaultValue: { summary: "var(--radius)" },
      },
    },
  },
  decorators: [withCSSVariables],
};
