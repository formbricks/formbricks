import type { Meta, StoryObj } from "@storybook/react-vite";
import { BarChart, FileText, Home, InfoIcon, KeyRound, Settings, User, UserIcon } from "lucide-react";
import { useState } from "react";
import { TabNav } from "./index";

// Story options separate from component props
interface StoryOptions {
  showIcons: boolean;
  numberOfTabs: number;
  tabTexts: string;
}

type StoryProps = React.ComponentProps<typeof TabNav> & StoryOptions;

// Available icons for tabs
const availableIcons = [Home, User, Settings, UserIcon, KeyRound, InfoIcon, FileText, BarChart];

const meta: Meta<StoryProps> = {
  title: "UI/TabNav",
  component: TabNav,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: {
      sort: "requiredFirst",
      exclude: [],
    },
    docs: {
      description: {
        component: `
The **TabNav** component provides a navigation interface with tabs. It displays a horizontal bar with underline styling for the active tab. Each tab can include an optional icon.
        `,
      },
    },
  },
  argTypes: {
    // Story Options - Appearance Category
    showIcons: {
      control: "boolean",
      description: "Whether to show icons in tabs",
      table: {
        category: "Appearance",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
      order: 1,
    },

    // Story Options - Content Category
    numberOfTabs: {
      control: { type: "number", min: 2, max: 6, step: 1 },
      description: "Number of tabs to display",
      table: {
        category: "Content",
        type: { summary: "number" },
        defaultValue: { summary: "3" },
      },
      order: 1,
    },

    tabTexts: {
      control: "text",
      description: "Comma-separated tab labels (e.g., 'Home,Profile,Settings')",
      table: {
        category: "Content",
        type: { summary: "string" },
        defaultValue: { summary: "Home,Profile,Settings" },
      },
      order: 2,
    },
  },
};

export default meta;

type Story = StoryObj<typeof TabNav> & { args: StoryOptions };

// Create a render function to handle dynamic tab generation
const renderTabNav = (args: StoryProps) => {
  const { showIcons = true, numberOfTabs = 3, tabTexts = "Home,Profile,Settings", activeTabClassName } = args;

  // Parse tab texts from comma-separated string
  const tabLabels = tabTexts
    .split(",")
    .map((text) => text.trim())
    .filter(Boolean);

  // Ensure we have enough labels for the number of tabs
  const finalTabLabels = Array.from({ length: numberOfTabs }, (_, i) => tabLabels[i] || `Tab ${i + 1}`);

  // Generate tabs array
  const tabs = finalTabLabels.map((label, index) => {
    const IconComponent = availableIcons[index % availableIcons.length];
    return {
      id: `tab-${index + 1}`,
      label,
      icon: showIcons ? <IconComponent size={16} /> : undefined,
    };
  });

  // Wrapper component to handle state for stories
  const TabNavWithState = () => {
    const [activeId, setActiveId] = useState(tabs[0]?.id || "tab-1");

    return (
      // <div className="w-[60dvw]">
      <TabNav
        tabs={tabs}
        activeId={activeId}
        setActiveId={setActiveId}
        activeTabClassName={activeTabClassName}
      />
      // </div>
    );
  };

  return <TabNavWithState />;
};

export const Default: Story = {
  render: renderTabNav,
  args: {
    showIcons: false,
    numberOfTabs: 3,
    tabTexts: "Home,Profile,Settings",
  },
};

export const WithIcons: Story = {
  render: renderTabNav,
  args: {
    showIcons: true,
    numberOfTabs: 3,
    tabTexts: "Home,Profile,Settings",
  },
  parameters: {
    docs: {
      description: {
        story: "Tab nav with icons alongside text labels.",
      },
    },
  },
};
