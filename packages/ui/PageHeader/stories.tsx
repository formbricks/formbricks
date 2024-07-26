import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../v2/Button";
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
    cta: <Button>Call to Action</Button>,
    children: <p className="text-slate-600">This is some additional content below the header.</p>,
  },
};

export const TitleOnly: Story = {
  args: {
    pageTitle: "Page Title",
  },
};

export const WithCTA: Story = {
  args: {
    pageTitle: "Page Title",
    cta: <Button>Call to Action</Button>,
  },
};

export const WithChildren: Story = {
  args: {
    pageTitle: "Page Title",
    children: <p className="text-slate-600">This is some additional content below the header.</p>,
  },
};
