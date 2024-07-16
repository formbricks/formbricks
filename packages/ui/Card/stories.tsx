import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Button } from "../Button";
import { Card } from "./index";

// Ensure Button is imported as it's used within the Card component

const meta: Meta<typeof Card> = {
  title: "ui/Card",
  component: Card,
  tags: ["autodocs"],
  argTypes: {
    icon: { control: SVGElement },
  },
};

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
    icon: (
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24">
        <path
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 5.365V3m0 2.365a5.338 5.338 0 0 1 5.133 5.368v1.8c0 2.386 1.867 2.982 1.867 4.175 0 .593 0 1.193-.538 1.193H5.538c-.538 0-.538-.6-.538-1.193 0-1.193 1.867-1.789 1.867-4.175v-1.8A5.338 5.338 0 0 1 12 5.365Zm-8.134 5.368a8.458 8.458 0 0 1 2.252-5.714m14.016 5.714a8.458 8.458 0 0 0-2.252-5.714M8.54 17.901a3.48 3.48 0 0 0 6.92 0H8.54Z"
        />
      </svg>
    ),
  },
};
