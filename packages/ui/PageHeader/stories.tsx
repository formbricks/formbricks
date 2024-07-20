// src/components/PageHeader.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { PageHeader } from "./index";

const meta = {
  title: "ui/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The **PageHeader** component is used to provide a styled header section within the form fields. 
     `,
      },
    },
  },
  argTypes: {
    cta: { control: "text" },
    children: { control: "text" },
  },
} satisfies Meta<typeof PageHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    pageTitle: "Page Title",
    cta: <button className="rounded bg-blue-500 px-4 py-2 text-white">Call to Action</button>,
    children: <p className="text-slate-600">This is some additional content below the header.</p>,
  },
};

export const TitleOnly: Story = {
  args: {
    pageTitle: "Page Title",
    cta: null,
    children: null,
  },
};

export const WithCTA: Story = {
  args: {
    pageTitle: "Page Title",
    cta: <button className="rounded bg-blue-500 px-4 py-2 text-white">Call to Action</button>,
    children: null,
  },
};

export const WithChildren: Story = {
  args: {
    pageTitle: "Page Title",
    cta: null,
    children: <p className="text-slate-600">This is some additional content below the header.</p>,
  },
};
