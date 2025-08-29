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
import type { ComponentProps } from "react";
import { Button } from "../button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./index";

interface StoryOptions {
  showIcons: boolean;
  menuItemType: "default" | "checkbox" | "radio";
  showLabel: boolean;
  labelText: string;
  triggerVariant: "default" | "outline" | "ghost" | "secondary";
  disabled: boolean;
}

type StoryProps = ComponentProps<typeof DropdownMenuContent> & StoryOptions;

const meta: Meta<StoryProps> = {
  title: "UI/DropdownMenu",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: ["triggerText"] },
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
    menuItemType: {
      control: "select",
      options: ["default", "checkbox", "radio"],
      description: "Type of menu items to display",
      table: {
        category: "Content",
        type: { summary: "string" },
        defaultValue: { summary: "default" },
      },
      order: 3,
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
    disabled: {
      control: "boolean",
      description: "Whether the menu is disabled",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 4,
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
    triggerVariant = "outline",
    showIcons = true,
    menuItemType = "default",
    showLabel = false,
    labelText = "Survey Actions",
    disabled = false,
    ...contentProps
  } = args;

  // Ensure we have the right number of items
  const menuItems = Array.from({ length: 8 }, (_, i) => `Menu Item ${i + 1}`);

  // Get appropriate icons based on menu type
  const iconSet = [Edit3, Copy, Share, Download, Trash2, Eye, BarChart, Users, Settings];

  // Determine if we need separators (for destructive actions)
  const needsDestructiveSeparator = menuItems.some(
    (item) => item.toLowerCase().includes("delete") || item.toLowerCase().includes("remove")
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant={triggerVariant} size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent sideOffset={sideOffset} className={className} {...contentProps}>
        {showLabel && (
          <>
            <DropdownMenuLabel>{labelText}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}

        {menuItemType === "radio" && (
          <DropdownMenuRadioGroup value={menuItems[0]}>
            {menuItems.map((label, index) => {
              const IconComponent = showIcons ? iconSet[index % iconSet.length] : undefined;
              return (
                <DropdownMenuRadioItem value={label} key={label}>
                  {IconComponent ? <IconComponent className="h-4 w-4" /> : undefined}
                  <span className="ml-2">{label}</span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        )}
        <DropdownMenuGroup>
          {(menuItemType === "default" || menuItemType === "checkbox") &&
            menuItems.map((label, index) => {
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
                <div key={label}>
                  {needsSeparatorBefore && <DropdownMenuSeparator />}
                  {menuItemType === "default" && (
                    <DropdownMenuItem
                      icon={IconComponent ? <IconComponent className="h-4 w-4" /> : undefined}
                      className={isDestructive ? "text-red-600 focus:text-red-600" : undefined}>
                      {label}
                    </DropdownMenuItem>
                  )}
                  {menuItemType === "checkbox" && (
                    <DropdownMenuCheckboxItem
                      checked={index === 0}
                      className={isDestructive ? "text-red-600 focus:text-red-600" : undefined}>
                      {IconComponent ? <IconComponent className="h-4 w-4" /> : undefined}
                      <span className="ml-2">{label}</span>
                    </DropdownMenuCheckboxItem>
                  )}
                </div>
              );
            })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const Default: Story = {
  render: renderDropdownMenu,
  args: {
    triggerVariant: "outline",
    showIcons: true,
    menuItemType: "default",
    showLabel: false,
    labelText: "Survey Actions",
    sideOffset: 4,
  },
};

export const Disabled: Story = {
  render: renderDropdownMenu,
  args: {
    disabled: true,
  },
};

export const Checkbox: Story = {
  render: renderDropdownMenu,
  args: {
    triggerVariant: "outline",
    showIcons: true,
    menuItemType: "checkbox",
    showLabel: false,
    labelText: "Survey Actions",
    sideOffset: 4,
  },
};

export const Radio: Story = {
  render: renderDropdownMenu,
  args: {
    triggerVariant: "outline",
    showIcons: true,
    menuItemType: "radio",
    showLabel: false,
    labelText: "Survey Actions",
    sideOffset: 4,
  },
};

export const WithLabel: Story = {
  render: renderDropdownMenu,
  args: {
    triggerVariant: "outline",
    showIcons: true,
    menuItemType: "default",
    showLabel: true,
    labelText: "Survey Actions",
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
    triggerVariant: "outline",
    showIcons: true,
    menuItemType: "default",
    showLabel: true,
    labelText: "All Actions",
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
