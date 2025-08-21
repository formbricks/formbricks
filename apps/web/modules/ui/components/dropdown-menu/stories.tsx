import { Meta, StoryObj } from "@storybook/react-vite";
import {
  BarChart,
  Copy,
  Download,
  Edit3,
  Eye,
  MoreHorizontal,
  Settings,
  Share,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "../button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./index";

// Story options separate from component props
interface StoryOptions {
  triggerText: string;
  showIcons: boolean;
  numberOfMenuItems: number;
  menuItemType: "all" | "actions" | "navigation" | "mixed";
  menuItemLabels: string;
  showLabel: boolean;
  labelText: string;
  showSeparators: boolean;
  triggerVariant: "default" | "outline" | "ghost" | "secondary";
}

type StoryProps = React.ComponentProps<typeof DropdownMenuContent> & StoryOptions;

// Predefined menu item sets
const menuItemSets = {
  all: [
    "Edit Survey",
    "Copy Link",
    "Share Survey",
    "View Responses",
    "Analytics",
    "Export Data",
    "Settings",
    "Delete Survey",
  ],
  mixed: ["Edit Survey", "View Responses", "Export Data", "Delete Survey"],
};

const meta: Meta<StoryProps> = {
  title: "UI/DropdownMenu",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "The **DropdownMenu** component provides context menus and action menus for various interface elements. Built on Radix UI primitives with support for icons, separators, and keyboard navigation.",
      },
    },
  },
  argTypes: {
    // Component Props - Behavior Category
    sideOffset: {
      control: { type: "number", min: 0, max: 20, step: 1 },
      description: "Distance between trigger and menu content",
      table: {
        category: "Behavior",
        type: { summary: "number" },
        defaultValue: { summary: "4" },
      },
      order: 1,
    },

    // Story Options - Appearance Category
    triggerVariant: {
      control: "select",
      options: ["default", "outline", "ghost", "secondary"],
      description: "Visual style of the trigger button",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "outline" },
      },
      order: 1,
    },
    showIcons: {
      control: "boolean",
      description: "Whether to show icons in menu items",
      table: {
        category: "Appearance",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
      order: 2,
    },
    showLabel: {
      control: "boolean",
      description: "Whether to show a label at the top of the menu",
      table: {
        category: "Appearance",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 3,
    },
    showSeparators: {
      control: "boolean",
      description: "Whether to show separators between menu sections",
      table: {
        category: "Appearance",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
      order: 4,
    },

    // Story Options - Content Category
    triggerText: {
      control: "text",
      description: "Text for the trigger button",
      table: {
        category: "Content",
        type: { summary: "string" },
        defaultValue: { summary: "Open Menu" },
      },
      order: 1,
    },
    numberOfMenuItems: {
      control: { type: "number", min: 1, max: 10, step: 1 },
      description: "Number of menu items to display",
      table: {
        category: "Content",
        type: { summary: "number" },
        defaultValue: { summary: "4" },
      },
      order: 2,
    },
    menuItemType: {
      control: "select",
      options: ["all", "actions", "navigation", "mixed"],
      description: "Type of menu items to display",
      table: {
        category: "Content",
        type: { summary: "string" },
        defaultValue: { summary: "mixed" },
      },
      order: 3,
    },
    menuItemLabels: {
      control: "text",
      description: "Comma-separated menu item labels (e.g., 'Edit,Copy,Delete')",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 4,
    },
    labelText: {
      control: "text",
      description: "Text for the menu label",
      table: {
        category: "Content",
        type: { summary: "string" },
        defaultValue: { summary: "Survey Actions" },
      },
      order: 5,
    },
  },
};

export default meta;

type Story = StoryObj<StoryProps>;

// Create a render function to handle dynamic menu generation
const renderDropdownMenu = (args: StoryProps) => {
  const {
    sideOffset = 4,
    className,
    triggerText = "Open Menu",
    triggerVariant = "outline",
    showIcons = true,
    numberOfMenuItems = 4,
    menuItemType = "mixed",
    menuItemLabels = "",
    showLabel = false,
    labelText = "Survey Actions",
    showSeparators = true,
    ...contentProps
  } = args;

  // Parse custom labels or use predefined sets
  let finalLabels: string[];
  if (menuItemLabels.trim()) {
    finalLabels = menuItemLabels
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean);
  } else {
    finalLabels = menuItemSets[menuItemType] || menuItemSets.mixed;
  }

  // Ensure we have the right number of items
  const menuItems = Array.from(
    { length: numberOfMenuItems },
    (_, i) => finalLabels[i] || `Menu Item ${i + 1}`
  );

  // Get appropriate icons based on menu type
  const iconSet = [Edit3, Copy, Share, Download, Trash2, Eye, BarChart, Users, Settings];

  // Determine if we need separators (for destructive actions)
  const needsDestructiveSeparator =
    showSeparators &&
    menuItems.some((item) => item.toLowerCase().includes("delete") || item.toLowerCase().includes("remove"));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={triggerVariant} size="icon">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{triggerText}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent sideOffset={sideOffset} className={className} {...contentProps}>
        {showLabel && (
          <>
            <DropdownMenuLabel>{labelText}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}

        {menuItems.map((label, index) => {
          const IconComponent = showIcons ? iconSet[index % iconSet.length] : undefined;
          const isDestructive =
            label.toLowerCase().includes("delete") || label.toLowerCase().includes("remove");

          // Add separator before destructive actions
          const needsSeparatorBefore =
            needsDestructiveSeparator &&
            isDestructive &&
            index > 0 &&
            !menuItems[index - 1]?.toLowerCase().includes("delete");

          return (
            <div key={`item-${index}`}>
              {needsSeparatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                icon={IconComponent ? <IconComponent className="h-4 w-4" /> : undefined}
                className={isDestructive ? "text-red-600 focus:text-red-600" : undefined}>
                {label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const Default: Story = {
  render: renderDropdownMenu,
  args: {
    triggerText: "Survey Actions",
    triggerVariant: "outline",
    showIcons: true,
    numberOfMenuItems: 4,
    menuItemType: "mixed",
    menuItemLabels: "",
    showLabel: false,
    labelText: "Survey Actions",
    showSeparators: true,
    sideOffset: 4,
  },
};

export const WithLabel: Story = {
  render: renderDropdownMenu,
  args: {
    triggerText: "Survey Actions",
    triggerVariant: "outline",
    showIcons: true,
    numberOfMenuItems: 5,
    menuItemType: "all",
    menuItemLabels: "",
    showLabel: true,
    labelText: "Survey Actions",
    showSeparators: true,
    sideOffset: 4,
  },
  parameters: {
    docs: {
      description: {
        story: "Use when you need to provide context about the menu content with a descriptive label.",
      },
    },
  },
};

export const ManyItems: Story = {
  render: renderDropdownMenu,
  args: {
    triggerText: "More Options",
    triggerVariant: "outline",
    showIcons: true,
    numberOfMenuItems: 8,
    menuItemType: "all",
    menuItemLabels: "",
    showLabel: true,
    labelText: "All Actions",
    showSeparators: true,
    sideOffset: 4,
  },
  parameters: {
    docs: {
      description: {
        story: "Shows how the menu handles many items with proper grouping and separators.",
      },
    },
  },
};
