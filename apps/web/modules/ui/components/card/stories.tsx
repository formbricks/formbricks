import type { Meta, StoryObj } from "@storybook/react";
import { BellRing } from "lucide-react";
import { Card } from "./index";

const meta = {
  component: Card,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `The **card** component is used to display a card with a label, description, and optional icon. It can also display a status and buttons for connecting and viewing documentation.`,
      },
    },
    argTypes: {
      icon: { control: "text" },
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
