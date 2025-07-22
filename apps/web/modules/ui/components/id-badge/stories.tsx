import { Meta, StoryObj } from "@storybook/react-vite";
import { IdBadge } from "./index";

const meta: Meta<typeof IdBadge> = {
  title: "UI/IdBadge",
  component: IdBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "The **IdBadge** component displays an ID value with an optional copy-to-clipboard functionality. Use it to show identifiers like survey IDs, response IDs, or other reference numbers that users might need to copy.",
      },
    },
  },
  argTypes: {
    id: {
      control: "text",
      description: "The ID value to display",
      table: {
        category: "Content",
        type: { summary: "string | number" },
      },
      order: 1,
    },
    prefix: {
      control: "text",
      description: "Custom prefix text before the ID",
      table: {
        category: "Content",
        type: { summary: "string" },
        defaultValue: { summary: "ID:" },
      },
      order: 2,
    },
    showCopyIcon: {
      control: "boolean",
      description: "Whether to show the copy icon",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
      order: 3,
    },
    showCopyIconOnHover: {
      control: "boolean",
      description: "Show copy icon only when hovering over the badge",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 4,
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
      order: 7,
    },
  },
};

export default meta;
type Story = StoryObj<typeof IdBadge>;

export const Default: Story = {
  args: {
    id: "1734",
  },
  parameters: {
    docs: {
      description: {
        story:
          "The default ID badge with a visible copy icon. Click the icon to copy the ID to your clipboard.",
      },
    },
  },
};

export const HiddenIcon: Story = {
  args: {
    id: "1734",
    showCopyIcon: false,
  },
  parameters: {
    docs: {
      description: {
        story: "ID badge without a copy icon. Useful when copy functionality is not needed.",
      },
    },
  },
};

export const ShowOnHover: Story = {
  args: {
    id: "1734",
    showCopyIconOnHover: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Copy icon appears only when hovering over the badge. Perfect for table rows where you want to reduce visual clutter.",
      },
    },
  },
};

export const CustomPrefix: Story = {
  args: {
    id: "SRV-001",
    prefix: "Survey:",
  },
  parameters: {
    docs: {
      description: {
        story: "Use custom prefixes to clarify what type of ID is being displayed.",
      },
    },
  },
};

export const NumericId: Story = {
  args: {
    id: 123456789,
    prefix: "Response:",
  },
  parameters: {
    docs: {
      description: {
        story: "The component works with both string and numeric ID values.",
      },
    },
  },
};

export const LongId: Story = {
  args: {
    id: "abcd1234-ef56-7890-abcd-ef1234567890",
    prefix: "UUID:",
  },
  parameters: {
    docs: {
      description: {
        story: "Handles long IDs like UUIDs gracefully while maintaining readable layout.",
      },
    },
  },
};

export const CustomStyling: Story = {
  args: {
    id: "1734",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  parameters: {
    docs: {
      description: {
        story: "Custom styling can be applied using the className prop to match your design system.",
      },
    },
  },
};

export const InTable: Story = {
  render: () => (
    <div className="space-y-2">
      <div className="mb-3 text-sm font-medium text-slate-700">Table Row Examples:</div>
      <div className="w-96 space-y-1">
        <div className="flex items-center justify-between rounded border bg-white p-2">
          <span className="text-sm">Survey Response #1</span>
          <IdBadge id="1734" showCopyIconOnHover />
        </div>
        <div className="flex items-center justify-between rounded border bg-white p-2">
          <span className="text-sm">Survey Response #2</span>
          <IdBadge id="1735" showCopyIconOnHover />
        </div>
        <div className="flex items-center justify-between rounded border bg-white p-2">
          <span className="text-sm">Survey Response #3</span>
          <IdBadge id="1736" showCopyIconOnHover />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Example of using ID badges in a table-like layout with hover-only copy icons to reduce visual clutter.",
      },
    },
  },
};

export const MultipleVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="mb-3 text-sm font-medium text-slate-700">Different ID Types:</div>
      <div className="flex flex-wrap gap-3">
        <IdBadge id="1734" prefix="Survey:" />
        <IdBadge id="RSP-001" prefix="Response:" />
        <IdBadge id="USR-456" prefix="User:" />
        <IdBadge id="PRJ-789" prefix="Project:" />
        <IdBadge id="ENV-123" prefix="Environment:" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Various examples showing different types of IDs that might be used throughout the Formbricks application.",
      },
    },
  },
};
