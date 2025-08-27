import { Meta, StoryObj } from "@storybook/react-vite";
import { AlertTriangle, Download, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import { fn } from "storybook/test";
import { Button } from "../button";
import { ConfirmationModal } from "./index";

type StoryProps = React.ComponentProps<typeof ConfirmationModal>;

const meta: Meta<StoryProps> = {
  title: "UI/ConfirmationModal",
  component: ConfirmationModal,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: ["open", "setOpen", "onConfirm", "Icon"] },
    docs: {
      description: {
        component:
          "The **ConfirmationModal** component provides a modal dialog for confirming user actions. It supports customizable content, button variants, loading states, and flexible interaction patterns for both destructive and non-destructive confirmations.",
      },
    },
  },
  argTypes: {
    isButtonDisabled: {
      control: "boolean",
      description: "Disables the confirmation button",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 1,
    },
    buttonLoading: {
      control: "boolean",
      description: "Shows loading state on confirmation button",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 2,
    },
    closeOnOutsideClick: {
      control: "boolean",
      description: "Allows closing modal by clicking outside",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
      order: 3,
    },
    hideCloseButton: {
      control: "boolean",
      description: "Hides the close button (X) in the modal",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 4,
    },
    onConfirm: {
      action: "onConfirm",
      description: "Function called when confirmation button is clicked",
      table: {
        category: "Behavior",
        type: { summary: "function" },
      },
      order: 5,
    },
    setOpen: {
      action: "setOpen",
      description: "Function to control modal open state",
      table: {
        category: "Behavior",
        type: { summary: "function" },
      },
      order: 6,
    },

    // Component Props - Appearance Category
    buttonVariant: {
      control: "select",
      options: ["destructive", "default"],
      description: "Visual variant of the confirmation button",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "destructive" },
      },
      order: 1,
    },

    // Component Props - Content Category
    title: {
      control: "text",
      description: "Title text displayed in the modal header",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 1,
    },
    description: {
      control: "text",
      description: "Optional description text below the title",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 2,
    },
    body: {
      control: "text",
      description: "Main body text content of the modal",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 3,
    },
    buttonText: {
      control: "text",
      description: "Text displayed on the confirmation button",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 4,
    },
    cancelButtonText: {
      control: "text",
      description: "Text displayed on the close button",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 5,
    },
  },
  args: {
    onConfirm: fn(),
    setOpen: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof ConfirmationModal>;

// Create a render function for interactive modals
const RenderConfirmationModal = (args: StoryProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Extract component props
  const {
    title,
    body,
    buttonText,
    description,
    isButtonDisabled = false,
    buttonVariant = "destructive",
    buttonLoading = false,
    closeOnOutsideClick = true,
    hideCloseButton = false,
    onConfirm,
    setOpen,
    cancelButtonText,
    Icon,
  } = args;

  return (
    <div>
      <Button variant="default" onClick={() => setIsOpen(true)}>
        Open Modal
      </Button>
      <ConfirmationModal
        open={isOpen}
        setOpen={(open) => {
          setIsOpen(open);
          setOpen?.(open);
        }}
        title={title}
        description={description}
        body={body}
        buttonText={buttonText}
        isButtonDisabled={isButtonDisabled}
        buttonVariant={buttonVariant}
        buttonLoading={buttonLoading}
        closeOnOutsideClick={closeOnOutsideClick}
        hideCloseButton={hideCloseButton}
        cancelButtonText={cancelButtonText}
        Icon={Icon}
        onConfirm={() => {
          onConfirm?.();
          setIsOpen(false);
        }}
      />
    </div>
  );
};

export const Default: Story = {
  render: RenderConfirmationModal,
  args: {
    title: "Edit Survey",
    description: "Are you sure you want to edit this survey?",
    body: "This action cannot be undone. All collected responses and analytics data will be permanently removed.",
    buttonText: "Edit Survey",
    Icon: Pencil,
    isButtonDisabled: false,
    buttonVariant: "default",
    buttonLoading: false,
    closeOnOutsideClick: true,
    hideCloseButton: false,
  },
};

export const Loading: Story = {
  render: RenderConfirmationModal,
  args: {
    title: "Export Survey Data",
    description: "Generating your export file...",
    body: "Please wait while we prepare your survey data for export. This may take a few moments depending on the amount of data.",
    buttonText: "Exporting...",
    Icon: Download,
    isButtonDisabled: false,
    buttonVariant: "default",
    buttonLoading: true,
    closeOnOutsideClick: true,
    hideCloseButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Shows loading state during async operations like data export or processing.",
      },
    },
  },
};

export const Disabled: Story = {
  render: RenderConfirmationModal,
  args: {
    title: "Publish Survey",
    description: "This survey cannot be published yet.",
    body: "Please complete all required questions and configure your survey settings before publishing. Check the survey builder for any validation errors.",
    buttonText: "Publish Survey",
    Icon: AlertTriangle,
    isButtonDisabled: true,
    buttonVariant: "default",
    buttonLoading: false,
    closeOnOutsideClick: true,
    hideCloseButton: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use when the confirmation action is temporarily unavailable due to validation errors or missing requirements.",
      },
    },
  },
};

export const NoDescription: Story = {
  render: RenderConfirmationModal,
  args: {
    title: "Reset Form",
    description: "",
    body: "All form data will be cleared and returned to default values. This action cannot be undone.",
    buttonText: "Reset Form",
    Icon: RefreshCw,
    isButtonDisabled: false,
    buttonVariant: "destructive",
    buttonLoading: false,
    closeOnOutsideClick: true,
    hideCloseButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Modal without description text, showing only title and body content.",
      },
    },
  },
};

export const LongContent: Story = {
  render: RenderConfirmationModal,
  args: {
    title: "Delete API Integration",
    description: "This will permanently remove the integration and all its associated data.",
    body: "Deleting this API integration will permanently remove all configuration settings, authentication tokens, webhook endpoints, and data mapping rules. Any automated workflows that depend on this integration will stop working immediately.",
    buttonText: "Delete Integration",
    isButtonDisabled: false,
    buttonVariant: "destructive",
    buttonLoading: false,
    closeOnOutsideClick: true,
    hideCloseButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Example with extensive content to test modal layout with longer text descriptions.",
      },
    },
  },
};

export const CustomStyling: Story = {
  render: RenderConfirmationModal,
  args: {
    title: "Custom Styled Modal",
    description: "This modal demonstrates custom content styling.",
    body: "You can customize the appearance and behavior of confirmation modals to match your specific use case and design requirements.",
    buttonText: "Proceed",
    isButtonDisabled: false,
    buttonVariant: "default",
    buttonLoading: false,
    closeOnOutsideClick: true,
    hideCloseButton: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Example showing how the modal can be customized for different use cases and styling needs.",
      },
    },
  },
};
