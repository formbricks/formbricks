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
          "The **IdBadge** component displays an ID value with copy-to-clipboard functionality that can be controlled or disabled. Use it to show identifiers like survey IDs, response IDs, or other reference numbers. The label appears outside the badge and supports both row and column layouts. Copy functionality is enabled by default but can be disabled with `copyDisabled` or controlled with hover behavior using `showCopyIconOnHover`.",
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
    label: {
      control: "text",
      description: "Optional label text that appears outside the badge",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 2,
    },
    variant: {
      control: "select",
      options: ["row", "column"],
      description: "Layout variant - row (horizontal) or column (vertical)",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "row" },
      },
      order: 3,
    },
    copyDisabled: {
      control: "boolean",
      description: "Whether to disable the copy functionality entirely",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 4,
    },
    showCopyIconOnHover: {
      control: "boolean",
      description:
        "Show copy icon only when hovering over the badge. When enabled, this overrides copyDisabled.",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 5,
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
      order: 6,
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
          "The default ID badge with a visible copy icon. Click the icon to copy the ID to your clipboard. The copied state will reset after 10 seconds.",
      },
    },
  },
};

export const ColumnLayout: Story = {
  args: {
    id: "1734",
    label: "ID",
    variant: "column",
  },
  parameters: {
    docs: {
      description: {
        story: "ID badge with label in column layout - label appears above the badge.",
      },
    },
  },
};

export const RowLayout: Story = {
  args: {
    id: "1734",
    label: "ID",
    variant: "row",
  },
  parameters: {
    docs: {
      description: {
        story: "ID badge with label in row layout - label appears beside the badge.",
      },
    },
  },
};

export const DisabledCopy: Story = {
  args: {
    id: "1734",
    label: "ID",
    copyDisabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: "ID badge with copy functionality disabled. Useful when copy functionality is not needed.",
      },
    },
  },
};

export const ShowOnHover: Story = {
  args: {
    id: "1734",
    label: "ID",
    showCopyIconOnHover: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Copy icon appears only when hovering over the badge. Perfect for table rows where you want to reduce visual clutter. Note: The hover state also makes the badge background slightly less dark (alpha-80).",
      },
    },
  },
};

export const HoverOverridesDisabled: Story = {
  args: {
    id: "1734",
    label: "Override Demo",
    copyDisabled: true,
    showCopyIconOnHover: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "When showCopyIconOnHover is enabled, it overrides the copyDisabled setting. Even though copyDisabled is true, the copy icon will still appear on hover.",
      },
    },
  },
};

export const CustomStyling: Story = {
  args: {
    id: "1734",
    label: "Custom",
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
          "Example of using ID badges in a table-like layout with hover-only copy icons to reduce visual clutter. Notice the improved hover state with alpha-80 background.",
      },
    },
  },
};

export const VariantsComparison: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="mb-3 text-sm font-medium text-slate-700">Layout Variants:</div>

      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-600">Row Layout (Default)</h4>
          <div className="flex flex-wrap gap-4">
            <IdBadge id="1734" label="Survey:" variant="row" />
            <IdBadge id="RSP-001" label="Response:" variant="row" />
            <IdBadge id="USR-456" label="User:" variant="row" />
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-600">Column Layout</h4>
          <div className="flex flex-wrap gap-4">
            <IdBadge id="1734" label="Survey:" variant="column" />
            <IdBadge id="RSP-001" label="Response:" variant="column" />
            <IdBadge id="USR-456" label="User:" variant="column" />
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Comparison of row and column layout variants. Use row layout for space-efficient display and column layout when you want clear separation between label and badge.",
      },
    },
  },
};
