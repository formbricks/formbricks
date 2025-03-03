import { Button } from "@/modules/ui/components/button";
import { PageHeader } from "@/modules/ui/components/page-header";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "ui/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The **PageHeader** component is used to provide a styled header section for a page. It includes a title and optional call to action (CTA) button. Additional content can be included below the header.
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
