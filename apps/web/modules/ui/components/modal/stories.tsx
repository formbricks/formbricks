import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { Modal } from "./index";

const meta = {
  title: "Deprecated/Modal",
  component: Modal,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: "Modal component for displaying content in an overlay.",
      },
      story: {
        inline: true,
      },
    },
  },
  argTypes: {
    open: { control: "boolean" },
    setOpen: { action: "setOpen" },
    title: { control: "text" },
    noPadding: { control: "boolean" },
    blur: { control: "boolean" },
    closeOnOutsideClick: { control: "boolean" },
    size: { control: { type: "select", options: ["md", "lg"] } },
    hideCloseButton: { control: "boolean" },
    restrictOverflow: { control: "boolean" },
  },
  args: { setOpen: fn() },
} satisfies Meta<typeof Modal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    children: <div>Default Modal Content</div>,
    title: "Default Modal",
  },
  parameters: {
    docs: {
      primary: true,
    },
  },
};

export const LargeSize: Story = {
  args: {
    ...Default.args,
    size: "lg",
    title: "Large Modal",
  },
};

export const NoPadding: Story = {
  args: {
    ...Default.args,
    noPadding: true,
    title: "Modal without Padding",
  },
};

export const WithBlur: Story = {
  args: {
    ...Default.args,
    blur: true,
    title: "Modal with Blur",
  },
};

export const HideCloseButton: Story = {
  args: {
    ...Default.args,
    hideCloseButton: true,
    title: "Modal without Close Button",
  },
};

export const PreventCloseOnOutsideClick: Story = {
  args: {
    ...Default.args,
    closeOnOutsideClick: false,
    title: "Modal that doesn't close on outside click",
  },
};

export const RestrictOverflow: Story = {
  args: {
    ...Default.args,
    restrictOverflow: true,
    title: "Modal with Restricted Overflow",
    children: (
      <div style={{ height: "500px", overflowY: "auto" }}>
        {Array(50)
          .fill(0)
          .map((_, i) => (
            <p key={i}>Scrollable content line {i + 1}</p>
          ))}
      </div>
    ),
  },
};
