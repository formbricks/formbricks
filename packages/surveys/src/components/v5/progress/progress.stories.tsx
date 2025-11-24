import type { Meta, StoryObj } from "@storybook/preact-vite";
import type { ComponentProps } from "preact";
import { useEffect, useState } from "preact/hooks";
import "../../../styles/global.css";
import { Progress } from "./index";

type ProgressProps = ComponentProps<typeof Progress>;

const meta: Meta<ProgressProps> = {
  title: "v5/Progress",
  component: Progress,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Displays an indicator showing the completion progress of a task, typically displayed as a progress bar.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story: any) => (
      <div id="fbjs" style={{ width: "400px", padding: "20px" }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    value: {
      control: { type: "range", min: 0, max: 100, step: 1 },
      description: "Current progress value",
      table: {
        type: { summary: "number" },
        defaultValue: { summary: "0" },
      },
    },
    max: {
      control: { type: "number" },
      description: "Maximum value",
      table: {
        type: { summary: "number" },
        defaultValue: { summary: "100" },
      },
    },
    containerStyling: {
      control: "object",
      description: "Custom styling object for the container",
      table: {
        type: { summary: "CSSProperties" },
        defaultValue: { summary: "{}" },
      },
    },
    indicatorStyling: {
      control: "object",
      description: "Custom styling object for the indicator",
      table: {
        type: { summary: "CSSProperties" },
        defaultValue: { summary: "{}" },
      },
    },
  },
};

export default meta;
type Story = StoryObj<ProgressProps>;

/**
 * Default progress bar with 50% completion
 */
export const Default: Story = {
  args: {
    value: 50,
  },
};

/**
 * Progress bar with no progress (0%)
 */
export const Empty: Story = {
  args: {
    value: 0,
  },
};

/**
 * Progress bar with full progress (100%)
 */
export const Complete: Story = {
  args: {
    value: 100,
  },
};

/**
 * Progress bar with gradient indicator
 */
export const customStyling: Story = {
  args: {
    value: 70,
    indicatorStyling: {
      background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)",
      height: "2rem",
    },
  },
};
