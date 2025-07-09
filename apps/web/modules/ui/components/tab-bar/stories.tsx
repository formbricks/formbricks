import { Meta, StoryObj } from "@storybook/react-vite";
import { Home, Settings, User } from "lucide-react";
import { useState } from "react";
import { TabBar } from "./index";

const meta: Meta<typeof TabBar> = {
  title: "UI/TabBar",
  component: TabBar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The **TabBar** component provides a navigation interface with tabs. It supports two visual styles: "bar" (traditional tab bar with underline) and "button" (button-style tabs). Each tab can include an optional icon.
        `,
      },
    },
  },
  argTypes: {
    tabStyle: {
      control: "select",
      options: ["bar", "button"],
      description: "Visual style of the tab bar",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "bar" },
      },
    },
    disabled: {
      control: "boolean",
      description: "Whether the tab bar is disabled",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    className: {
      control: "text",
      description: "Additional CSS classes for the container",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
    },
    activeTabClassName: {
      control: "text",
      description: "Additional CSS classes for the active tab",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof TabBar>;

// Wrapper component to handle state for stories
const TabBarWithState = (args: any) => {
  const [activeId, setActiveId] = useState(args.activeId || "home");

  return <TabBar {...args} activeId={activeId} setActiveId={setActiveId} />;
};

export const Default: Story = {
  render: TabBarWithState,
  args: {
    tabStyle: "bar",
    disabled: false,
    tabs: [
      { id: "home", label: "Home" },
      { id: "profile", label: "Profile" },
      { id: "settings", label: "Settings" },
    ],
    activeId: "home",
  },
};

export const WithIcons: Story = {
  render: TabBarWithState,
  args: {
    tabStyle: "bar",
    disabled: false,
    tabs: [
      { id: "home", label: "Home", icon: <Home size={16} /> },
      { id: "profile", label: "Profile", icon: <User size={16} /> },
      { id: "settings", label: "Settings", icon: <Settings size={16} /> },
    ],
    activeId: "home",
  },
  parameters: {
    docs: {
      description: {
        story: "Tab bar with icons alongside text labels.",
      },
    },
  },
};

export const ButtonStyle: Story = {
  render: TabBarWithState,
  args: {
    tabStyle: "button",
    disabled: false,
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "analytics", label: "Analytics" },
      { id: "reports", label: "Reports" },
    ],
    activeId: "overview",
  },
  parameters: {
    docs: {
      description: {
        story: "Button-style tabs with rounded background for active state.",
      },
    },
  },
};

export const Disabled: Story = {
  render: TabBarWithState,
  args: {
    tabStyle: "button",
    disabled: true,
    tabs: [
      { id: "tab1", label: "Tab 1" },
      { id: "tab2", label: "Tab 2" },
      { id: "tab3", label: "Tab 3" },
    ],
    activeId: "tab1",
  },
  parameters: {
    docs: {
      description: {
        story: "Disabled tab bar that prevents user interaction.",
      },
    },
  },
};

export const ManyTabs: Story = {
  render: TabBarWithState,
  args: {
    tabStyle: "bar",
    disabled: false,
    tabs: [
      { id: "dashboard", label: "Dashboard" },
      { id: "users", label: "Users" },
      { id: "products", label: "Products" },
      { id: "orders", label: "Orders" },
      { id: "analytics", label: "Analytics" },
      { id: "settings", label: "Settings" },
    ],
    activeId: "dashboard",
  },
  parameters: {
    docs: {
      description: {
        story: "Tab bar with multiple tabs to demonstrate overflow behavior.",
      },
    },
  },
};

export const CustomStyling: Story = {
  render: TabBarWithState,
  args: {
    tabStyle: "bar",
    disabled: false,
    className: "bg-blue-50 border border-blue-200",
    activeTabClassName: "text-blue-600 border-blue-600",
    tabs: [
      { id: "home", label: "Home" },
      { id: "about", label: "About" },
      { id: "contact", label: "Contact" },
    ],
    activeId: "home",
  },
  parameters: {
    docs: {
      description: {
        story: "Tab bar with custom styling applied to container and active tab.",
      },
    },
  },
};
