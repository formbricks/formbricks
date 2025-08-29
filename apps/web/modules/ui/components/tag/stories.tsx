import { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Tag } from "./index";

type StoryProps = React.ComponentProps<typeof Tag>;

const meta: Meta<StoryProps> = {
  title: "UI/Tag",
  component: Tag,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: ["tags", "setTagsState", "onDelete", "tagId", "highlight"] },
    docs: {
      description: {
        component:
          "The **Tag** component provides a way to display categorized labels with optional delete functionality. Supports multiple variants for different contexts.",
      },
    },
  },
  argTypes: {
    // Behavior
    allowDelete: {
      control: "boolean",
      description: "Whether the delete button is shown",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
      order: 2,
    },
    // Content
    tagName: {
      control: "text",
      description: "The text label of the tag",
      table: {
        category: "Content",
        type: { summary: "string" },
        defaultValue: { summary: "Tag label" },
      },
      order: 1,
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tag>;

// Interactive wrapper for stories that need state management
const InteractiveTag = (args: any) => {
  const [isDeleted, setIsDeleted] = useState(false);

  const handleDelete = (tagId: string) => {
    setIsDeleted(true);
    args.onDelete?.(tagId);
    // Reset after a short delay for demo purposes
    setTimeout(() => setIsDeleted(false), 2000);
  };

  if (isDeleted) {
    return <div className="text-sm italic text-slate-500">Tag deleted (will reappear in 2s)</div>;
  }

  return <Tag {...args} onDelete={handleDelete} />;
};

export const Default: Story = {
  args: {
    tagId: "survey-1",
    tagName: "Customer Feedback",
    allowDelete: true,
    highlight: false,
    onDelete: () => {},
  },
};

export const NoDelete: Story = {
  args: {
    ...Default.args,
    allowDelete: false,
    tagName: "Read-only Tag",
  },
  parameters: {
    docs: {
      description: {
        story: "Tag without delete functionality for read-only contexts.",
      },
    },
  },
};

export const Interactive: Story = {
  render: InteractiveTag,
  args: {
    ...Default.args,
    tagName: "Interactive Tag",
  },
  parameters: {
    docs: {
      description: {
        story: "Interactive tag that demonstrates delete functionality with visual feedback.",
      },
    },
  },
};

export const LongText: Story = {
  args: {
    ...Default.args,
    tagName: "This is a very long tag name that might overflow",
    onDelete: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: "Tag with long text to test overflow behavior and text wrapping.",
      },
    },
  },
};
