import type { Meta, StoryObj } from "@storybook/react";
import { BarChart, FileText, InfoIcon, KeyRound, Settings, UserIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./index";

// Story options separate from component props
interface StoryOptions {
  size?: "default" | "big";
  showIcons?: boolean;
  numberOfTabs?: number;
  tabTexts?: string;
  width?: "fill" | "fit";
  variant?: "default" | "disabled";
}

type StoryProps = React.ComponentProps<typeof Tabs> & StoryOptions;

// Available icons for tabs
const availableIcons = [UserIcon, KeyRound, InfoIcon, Settings, FileText, BarChart];

const meta: Meta<StoryProps> = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: {
      sort: "requiredFirst",
      exclude: [],
    },
  },
  argTypes: {
    // Story Options - Appearance Category
    size: {
      control: "select",
      options: ["default", "big"],
      description: "Size of the tabs",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "default" },
      },
      order: 1,
    },
    showIcons: {
      control: "boolean",
      description: "Whether to show icons in tabs",
      table: {
        category: "Appearance",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
      order: 2,
    },
    width: {
      control: "select",
      options: ["fill", "fit"],
      description: "Width behavior of the tabs component",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "fit" },
      },
      order: 3,
    },

    // Story Options - Content Category
    numberOfTabs: {
      control: { type: "number", min: 2, max: 6, step: 1 },
      description: "Number of tabs to display",
      table: {
        category: "Content",
        type: { summary: "number" },
        defaultValue: { summary: "2" },
      },
      order: 1,
    },
    tabTexts: {
      control: "text",
      description: "Comma-separated tab labels (e.g., 'Account,Password,Settings')",
      table: {
        category: "Content",
        type: { summary: "string" },
        defaultValue: { summary: "Account,Password" },
      },
      order: 2,
    },

    // Story Options - Behaviour Category
    variant: {
      control: "select",
      options: ["default", "disabled"],
      description: "Variant of the tabs",
      table: {
        category: "Behaviour",
        type: { summary: "string" },
        defaultValue: { summary: "default" },
      },
      order: 1,
    },
  },
};

export default meta;

type Story = StoryObj<StoryProps>;

// Create a render function to handle dynamic tab generation
const renderTabs = (args: StoryProps) => {
  const {
    variant = "default",
    size = "default",
    width = "fit",
    showIcons = true,
    numberOfTabs = 2,
    tabTexts = "Account,Password",
    defaultValue,
    ...tabsProps
  } = args;

  // Parse tab texts from comma-separated string
  const tabLabels = tabTexts
    .split(",")
    .map((text) => text.trim())
    .filter(Boolean);

  // Ensure we have enough labels for the number of tabs
  const finalTabLabels = Array.from({ length: numberOfTabs }, (_, i) => tabLabels[i] || `Tab ${i + 1}`);

  // Generate tab values
  const tabValues = finalTabLabels.map((_, i) => `tab${i + 1}`);

  const layout = size === "big" ? "column" : "row";

  return (
    <div className="w-full max-w-sm">
      <Tabs defaultValue={defaultValue || tabValues[0]} {...tabsProps}>
        <TabsList variant={variant} size={size} width={width}>
          {finalTabLabels.map((label, index) => {
            const IconComponent = availableIcons[index % availableIcons.length];
            return (
              <TabsTrigger
                key={tabValues[index]}
                value={tabValues[index]}
                layout={layout}
                size={size}
                icon={showIcons ? <IconComponent /> : undefined}
                showIcon={showIcons}>
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {finalTabLabels.map((label, index) => (
          <TabsContent key={tabValues[index]} value={tabValues[index]} className="mt-4">
            <div className="rounded-lg border p-6 text-sm">
              Content for {label} tab. This content can be of varying lengths to demonstrate how the tabs
              component handles different content widths.
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export const Default: Story = {
  render: renderTabs,
  args: {
    size: "default",
    width: "fit",
    showIcons: false,
    numberOfTabs: 2,
    tabTexts: "Account,Password",
  },
};

export const WithIcons: Story = {
  render: renderTabs,
  args: {
    size: "default",
    width: "fit",
    showIcons: true,
    numberOfTabs: 2,
    tabTexts: "Account,Password",
  },
  parameters: {
    docs: {
      description: {
        story: "Tabs with icons for enhanced visual navigation.",
      },
    },
  },
};

export const FillWidth: Story = {
  render: renderTabs,
  args: {
    size: "default",
    width: "fill",
    showIcons: true,
    numberOfTabs: 2,
    tabTexts: "Account,Password",
  },
  parameters: {
    docs: {
      description: {
        story: "Tabs that stretch to fill the full width of the parent, with triggers evenly distributed.",
      },
    },
  },
};

export const FitWidth: Story = {
  render: renderTabs,
  args: {
    size: "default",
    width: "fit",
    showIcons: true,
    numberOfTabs: 2,
    tabTexts: "Account,Password",
  },
  parameters: {
    docs: {
      description: {
        story: "Tabs that fit their content and are centered, with all triggers having equal width.",
      },
    },
  },
};

export const BigSize: Story = {
  render: renderTabs,
  args: {
    size: "big",
    width: "fit",
    showIcons: true,
    numberOfTabs: 2,
    tabTexts: "Account,Password",
  },
  parameters: {
    docs: {
      description: {
        story: "Larger tabs with column layout, useful for more prominent navigation.",
      },
    },
  },
};

export const Disabled: Story = {
  render: renderTabs,
  args: {
    variant: "disabled",
    size: "default",
    width: "fit",
    showIcons: true,
    numberOfTabs: 2,
    tabTexts: "Account,Password",
  },
  parameters: {
    docs: {
      description: {
        story: "Disabled tabs that cannot be interacted with.",
      },
    },
  },
};
