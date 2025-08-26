import { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { Button } from "../button";
import { DeleteDialog } from "./index";

interface StoryOptions {
  triggerText: string;
  hasChildren: boolean;
  numberOfListItems: number;
  childrenContent: string;
}

type StoryProps = React.ComponentProps<typeof DeleteDialog> & StoryOptions;

const meta: Meta<StoryProps> = {
  title: "UI/DeleteDialog",
  component: DeleteDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: ["open", "children", "setOpen", "onDelete", "onSave"] },
    docs: {
      description: {
        component:
          "The **DeleteDialog** component provides a confirmation dialog for destructive actions. It includes customizable content, loading states, and an optional save-instead-of-cancel functionality for complex workflows.",
      },
    },
  },
  argTypes: {
    text: {
      control: "text",
      description: "Text for the dialog",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 1,
    },
    isDeleting: {
      control: "boolean",
      description: "Shows loading state on delete button",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 2,
    },
    isSaving: {
      control: "boolean",
      description: "Shows loading state on cancel/save button",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 3,
    },
    disabled: {
      control: "boolean",
      description: "Disables the delete button",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 4,
    },
    useSaveInsteadOfCancel: {
      control: "boolean",
      description: "Changes cancel button to save button",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 5,
    },
    setOpen: {
      action: "setOpen",
      description: "Function to control dialog open state",
      table: {
        category: "Behavior",
        type: { summary: "function" },
      },
      order: 6,
    },
    onDelete: {
      action: "onDelete",
      description: "Function called when delete is confirmed",
      table: {
        category: "Behavior",
        type: { summary: "function" },
      },
      order: 7,
    },
    onSave: {
      action: "onSave",
      description: "Function called when save button is clicked",
      table: {
        category: "Behavior",
        type: { summary: "function" },
      },
      order: 8,
    },

    // Story Options - Content Category
    deleteWhat: {
      control: "text",
      description: "What is being deleted (e.g., 'Survey', 'User Response')",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 1,
    },
    triggerText: {
      control: "text",
      description: "Text for the trigger button",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 2,
    },
    hasChildren: {
      control: "boolean",
      description: "Whether to show additional children content",
      table: {
        category: "Content",
        type: { summary: "boolean" },
      },
      order: 4,
    },
    numberOfListItems: {
      control: { type: "number", min: 0, max: 10, step: 1 },
      description: "Number of list items to show in children",
      table: {
        category: "Content",
        type: { summary: "number" },
      },
      order: 5,
    },
    childrenContent: {
      control: "text",
      description: "Content for children section",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 6,
    },
  },
  args: {
    setOpen: fn(),
    onDelete: fn(),
    onSave: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof DeleteDialog> & { args: StoryOptions };

// Create a render function for interactive dialogs
const RenderDeleteDialog = (args: StoryProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Extract component props
  const {
    deleteWhat = "Survey",
    text,
    isDeleting = false,
    isSaving = false,
    useSaveInsteadOfCancel = false,
    onDelete,
    onSave,
    disabled = false,
  } = args;

  // Extract story options
  const {
    triggerText = "Delete Item",
    hasChildren = false,
    numberOfListItems = 3,
    childrenContent = "Additional content",
  } = args as StoryOptions;

  // Generate children content based on story options
  const children = hasChildren ? (
    <div className="mt-4 space-y-2">
      <p className="text-sm text-slate-600">{childrenContent}</p>
      {numberOfListItems > 0 && (
        <ul className="list-disc pl-4 text-sm text-slate-600">
          {Array.from({ length: numberOfListItems }, (_, i) => (
            <li key={i}>Related item {i + 1} will also be affected</li>
          ))}
        </ul>
      )}
    </div>
  ) : undefined;

  return (
    <div>
      <Button variant="destructive" onClick={() => setIsOpen(true)}>
        {triggerText}
      </Button>
      <DeleteDialog
        open={isOpen}
        setOpen={(open) => {
          setIsOpen(open);
          args.setOpen?.(open);
        }}
        deleteWhat={deleteWhat}
        onDelete={() => {
          onDelete?.();
          setIsOpen(false);
        }}
        onSave={() => {
          onSave?.();
          setIsOpen(false);
        }}
        text={text}
        isDeleting={isDeleting}
        isSaving={isSaving}
        useSaveInsteadOfCancel={useSaveInsteadOfCancel}
        disabled={disabled}>
        {children}
      </DeleteDialog>
    </div>
  );
};

export const Default: Story = {
  render: RenderDeleteDialog,
  args: {
    triggerText: "Delete Survey",
    deleteWhat: "Survey",
    text: "All responses and analytics data will be permanently lost.",
    hasChildren: false,
    numberOfListItems: 0,
    childrenContent: "",
    isDeleting: false,
    isSaving: false,
    disabled: false,
    useSaveInsteadOfCancel: false,
  },
};

export const Deleting: Story = {
  render: RenderDeleteDialog,
  args: {
    triggerText: "Delete User Account",
    deleteWhat: "User Account",
    text: "This will permanently delete the user account and all associated data.",
    hasChildren: false,
    numberOfListItems: 0,
    childrenContent: "",
    isDeleting: true,
    isSaving: false,
    disabled: false,
    useSaveInsteadOfCancel: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the loading state when delete operation is in progress.",
      },
    },
  },
};

export const Disabled: Story = {
  render: RenderDeleteDialog,
  args: {
    triggerText: "Delete Project",
    deleteWhat: "Project",
    text: "This project cannot be deleted because it has active surveys.",
    hasChildren: false,
    numberOfListItems: 0,
    childrenContent: "",
    isDeleting: false,
    isSaving: false,
    disabled: true,
    useSaveInsteadOfCancel: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Use when delete action is temporarily unavailable due to constraints.",
      },
    },
  },
};

export const WithChildren: Story = {
  render: RenderDeleteDialog,
  args: {
    triggerText: "Delete Environment",
    deleteWhat: "Environment",
    text: "Deleting this environment will affect the following:",
    hasChildren: true,
    numberOfListItems: 4,
    childrenContent: "This action will cascade to related resources:",
    isDeleting: false,
    isSaving: false,
    disabled: false,
    useSaveInsteadOfCancel: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Use when you need to show additional context or affected items in the delete dialog.",
      },
    },
  },
};

export const SaveInsteadOfCancel: Story = {
  render: RenderDeleteDialog,
  args: {
    triggerText: "Delete Response",
    deleteWhat: "Response",
    text: "You have unsaved changes. Save them before deleting this response?",
    hasChildren: false,
    numberOfListItems: 0,
    childrenContent: "",
    isDeleting: false,
    isSaving: false,
    disabled: false,
    useSaveInsteadOfCancel: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Use when there are unsaved changes that should be preserved before deletion.",
      },
    },
  },
};

export const SavingState: Story = {
  render: RenderDeleteDialog,
  args: {
    triggerText: "Delete with Save",
    deleteWhat: "Document",
    text: "You have unsaved changes. Save them before deleting?",
    hasChildren: false,
    numberOfListItems: 0,
    childrenContent: "",
    isDeleting: false,
    isSaving: true,
    disabled: false,
    useSaveInsteadOfCancel: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Shows loading state on the save button when saving changes before deletion.",
      },
    },
  },
};

export const LongText: Story = {
  render: RenderDeleteDialog,
  args: {
    triggerText: "Delete Integration",
    deleteWhat: "API Integration",
    text: "This action will permanently delete the API integration and all its configuration settings. This includes webhook endpoints, authentication tokens, data mappings, and historical sync logs. Connected third-party services will no longer receive data from this integration, and any automated workflows dependent on this integration will be disrupted. Please ensure you have backed up any necessary configuration data before proceeding.",
    hasChildren: true,
    numberOfListItems: 5,
    childrenContent: "The following connected services and data will be affected:",
    isDeleting: false,
    isSaving: false,
    disabled: false,
    useSaveInsteadOfCancel: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Example with extensive text content to test dialog layout with longer descriptions.",
      },
    },
  },
};
