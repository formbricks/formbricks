import { Meta, StoryObj } from "@storybook/react-vite";
import { BellRing } from "lucide-react";
import { Card } from "./index";

const meta: Meta<typeof Card> = {
  title: "UI/IntegrationCard",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `The **card** component is used to display a card with a label, description, and optional icon. It can also display a status and buttons for connecting and viewing documentation.`,
      },
    },
  },
  argTypes: {
    // Behavior
    connectHref: {
      control: "text",
      table: { category: "Behavior" },
    },
    connectNewTab: {
      control: "boolean",
      table: { category: "Behavior" },
    },
    docsHref: {
      control: "text",
      table: { category: "Behavior" },
    },
    docsNewTab: {
      control: "boolean",
      table: { category: "Behavior" },
    },
    connected: {
      control: "boolean",
      table: { category: "Behavior" },
    },
    disabled: {
      control: "boolean",
      table: { category: "Behavior" },
    },

    // Content
    label: {
      control: "text",
      table: { category: "Content" },
    },
    description: {
      control: "text",
      table: { category: "Content" },
    },
    connectText: {
      control: "text",
      table: { category: "Content" },
    },
    docsText: {
      control: "text",
      table: { category: "Content" },
    },
    statusText: {
      control: "text",
      table: { category: "Content" },
    },

    // Appearance
    icon: {
      control: false,
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: "Card Label",
    description: "This is the description of the card.",
    connectText: "Connect",
    connectHref: "#",
    connectNewTab: false,
    docsText: "Docs",
    docsHref: "#",
    docsNewTab: false,
    connected: true,
    statusText: "Connected",
  },
};

export const Disconnected: Story = {
  args: {
    label: "Card Label",
    description: "This is the description of the card.",
    connectText: "Connect",
    connectHref: "#",
    connectNewTab: false,
    docsText: "Docs",
    docsHref: "#",
    docsNewTab: false,
    connected: false,
    statusText: "Disconnected",
  },
};

export const WithIcon: Story = {
  args: {
    label: "Card Label",
    description: "This is the description of the card.",
    connectText: "Connect",
    connectHref: "#",
    connectNewTab: false,
    docsText: "Docs",
    docsHref: "#",
    docsNewTab: false,
    connected: true,
    statusText: "Connected",
    icon: <BellRing />,
  },
};
