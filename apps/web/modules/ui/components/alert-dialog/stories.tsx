import { Meta, StoryObj } from "@storybook/react-vite";
import { AlertDialog } from "./index";

const meta: Meta<typeof AlertDialog> = {
  title: "UI/AlertDialog",
  component: AlertDialog,
  tags: ["autodocs"],
  argTypes: {
    open: {
      control: "boolean",
      description: "Controls the open state of the dialog",
    },
    setOpen: {
      description: "Function to set the open state",
    },
    headerText: {
      control: "text",
      description: "Heading text for the dialog",
    },
    mainText: {
      control: "text",
      description: "Main content text for the dialog",
    },
    confirmBtnLabel: {
      control: "text",
      description: "Label for the confirmation button",
    },
    declineBtnLabel: {
      control: "text",
      description: "Optional label for the decline button",
    },
    declineBtnVariant: {
      control: "select",
      options: ["destructive", "ghost"],
      description: "Style variant for the decline button",
    },
    onConfirm: {
      description: "Function called when confirm button is clicked",
    },
    onDecline: {
      description: "Function called when decline button is clicked",
    },
  },
};

export default meta;

type Story = StoryObj<typeof AlertDialog>;

// Basic example
export const Default: Story = {
  args: {
    open: true,
    setOpen: () => {},
    headerText: "Confirm Action",
    mainText: "Are you sure you want to proceed with this action?",
    confirmBtnLabel: "Confirm",
    declineBtnLabel: "Cancel",
    onDecline: () => console.log("Declined"),
    onConfirm: () => console.log("Confirmed"),
  },
};

// Example with destructive action
export const Destructive: Story = {
  args: {
    open: true,
    setOpen: () => {},
    headerText: "Delete Item",
    mainText: "This action cannot be undone. Are you sure you want to delete this item?",
    confirmBtnLabel: "Delete",
    declineBtnLabel: "Cancel",
    declineBtnVariant: "ghost",
    onDecline: () => console.log("Declined"),
    onConfirm: () => console.log("Confirmed delete"),
  },
  parameters: {
    docs: {
      description: {
        story: "Used for destructive actions that require user confirmation.",
      },
    },
  },
};

// Example with warning
export const Warning: Story = {
  args: {
    open: true,
    setOpen: () => {},
    headerText: "Warning",
    mainText: "You are about to make changes that will affect multiple records.",
    confirmBtnLabel: "Proceed",
    declineBtnLabel: "Go Back",
    onDecline: () => console.log("Declined"),
    onConfirm: () => console.log("Confirmed proceed"),
  },
  parameters: {
    docs: {
      description: {
        story: "Used for warning users about consequential actions.",
      },
    },
  },
};

// Example with success confirmation
export const SuccessConfirmation: Story = {
  args: {
    open: true,
    setOpen: () => {},
    headerText: "Success",
    mainText: "Your changes have been saved successfully. Would you like to continue editing?",
    confirmBtnLabel: "Continue Editing",
    declineBtnLabel: "Close",
    onDecline: () => console.log("Closed"),
    onConfirm: () => console.log("Continue editing"),
  },
};

// Example with destructive decline button
export const DestructiveDecline: Story = {
  args: {
    open: true,
    setOpen: () => {},
    headerText: "Discard Changes",
    mainText: "You have unsaved changes. Are you sure you want to discard them?",
    confirmBtnLabel: "Keep Editing",
    declineBtnLabel: "Discard Changes",
    declineBtnVariant: "destructive",
    onDecline: () => console.log("Discarded changes"),
    onConfirm: () => console.log("Keep editing"),
  },
};
