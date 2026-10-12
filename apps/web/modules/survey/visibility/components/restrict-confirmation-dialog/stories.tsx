import { Meta, StoryObj } from "@storybook/react-vite";
import { RestrictConfirmationDialog } from "./index";

const meta: Meta<typeof RestrictConfirmationDialog> = {
  title: "Survey/Visibility/RestrictConfirmationDialog",
  component: RestrictConfirmationDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Confirms Visible → Restricted. Spells out who loses access, compares both values, and cannot complete while connections still depend on the survey.",
      },
    },
  },
  argTypes: {
    open: {
      control: "boolean",
      description: "Whether the dialog is open",
      table: { category: "Behavior", type: { summary: "boolean" } },
    },
    isSubmitting: {
      control: "boolean",
      description: "The change is in flight",
      table: { category: "Behavior", type: { summary: "boolean" } },
    },
    onConfirm: { action: "confirmed", table: { category: "Behavior" } },
    setOpen: { action: "setOpen", table: { category: "Behavior" } },
    author: {
      control: "object",
      description: "Who keeps access: you, a named author, or an unknown one",
      table: { category: "Content", type: { summary: "TRestrictedAuthor" } },
    },
    workspaceName: {
      control: "text",
      description: "The workspace losing access",
      table: { category: "Content", type: { summary: "string" } },
    },
    impact: {
      control: "object",
      description: "Colleagues and responses affected; null while loading",
      table: { category: "Content", type: { summary: "{ memberCount, responseCount } | null" } },
    },
    blockers: {
      control: "object",
      description: "Connections that make the change refusable",
      table: { category: "Content", type: { summary: "TSurveyVisibilityBlocker[]" } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RestrictConfirmationDialog>;

const baseArgs = {
  open: true,
  setOpen: () => undefined,
  onConfirm: () => undefined,
  workspaceName: "Acme",
  author: { kind: "you" as const },
  impact: { memberCount: 12, responseCount: 348 },
  blockers: [],
};

export const Default: Story = { args: baseArgs };

export const NamedAuthor: Story = {
  args: { ...baseArgs, author: { kind: "named", name: "Ada Lovelace" } },
};

export const SingleColleagueNoResponses: Story = {
  args: { ...baseArgs, impact: { memberCount: 1, responseCount: 0 } },
};

export const BlockersPresent: Story = {
  args: {
    ...baseArgs,
    blockers: [
      { id: "wh_1", name: "Zapier — new responses", type: "webhook" },
      { id: "int_1", name: "Google Sheets", type: "integration" },
      { id: "wf_1", name: "Escalate detractors", type: "workflow" },
    ],
  },
};

export const LoadingImpact: Story = { args: { ...baseArgs, impact: null } };

export const Submitting: Story = { args: { ...baseArgs, isSubmitting: true } };
