import { Meta, StoryObj } from "@storybook/react-vite";
import { ActivateDialog } from "./index";

const meta: Meta<typeof ActivateDialog> = {
  title: "Survey/Visibility/ActivateDialog",
  component: ActivateDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Asked when a restricted survey is activated or scheduled. Nothing is preselected; the primary action waits for a choice.",
      },
    },
  },
  argTypes: {
    open: {
      control: "boolean",
      description: "Whether the dialog is open",
      table: { category: "Behavior", type: { summary: "boolean" } },
    },
    isScheduling: {
      control: "boolean",
      description: "A publish date is set; the primary action schedules",
      table: { category: "Behavior", type: { summary: "boolean" } },
    },
    isSubmitting: {
      control: "boolean",
      description: "Visibility change or activation in flight",
      table: { category: "Behavior", type: { summary: "boolean" } },
    },
    onConfirm: { action: "confirmed", table: { category: "Behavior" } },
    setOpen: { action: "setOpen", table: { category: "Behavior" } },
    author: {
      control: "object",
      description: "Who keeps access when Restricted is chosen",
      table: { category: "Content", type: { summary: "TRestrictedAuthor" } },
    },
    workspaceName: {
      control: "text",
      description: "The workspace the survey can be made visible to",
      table: { category: "Content", type: { summary: "string" } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ActivateDialog>;

const baseArgs = {
  open: true,
  setOpen: () => undefined,
  onConfirm: () => undefined,
  workspaceName: "Acme",
  author: { kind: "you" as const },
  isScheduling: false,
};

export const Default: Story = { args: baseArgs };

export const Scheduling: Story = { args: { ...baseArgs, isScheduling: true } };

export const ManagerActivatingSomeoneElsesSurvey: Story = {
  args: { ...baseArgs, author: { kind: "named", name: "Ada Lovelace" } },
};

export const Submitting: Story = { args: { ...baseArgs, isSubmitting: true } };
