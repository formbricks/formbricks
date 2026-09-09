import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImportReport } from "./index";

const meta: Meta<typeof ImportReport> = {
  title: "Surveys/Import/ImportReport",
  component: ImportReport,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The import report: one row per change the import made or could not carry over. Collapsed when it holds notes only, expanded when a warning or error exists.",
      },
    },
  },
  argTypes: {
    issues: { control: "object", description: "Report issues", table: { category: "Content" } },
    defaultOpen: {
      control: "boolean",
      description: "Force the initial open state",
      table: { category: "Behavior" },
    },
    className: { control: "text", table: { category: "Appearance" } },
  },
  decorators: [
    (Story) => (
      <div className="w-[560px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ImportReport>;

export const Default: Story = {
  args: {
    issues: [
      {
        severity: "warning",
        code: "external_url_removed",
        path: "endings.0.buttonLink",
        message:
          "External links are not available on this plan. The link was removed; the survey still works.",
      },
      {
        severity: "info",
        code: "language_created",
        message: "Language 'de-DE' does not exist in this workspace yet and will be created.",
        vars: { code: "de-DE" },
      },
      {
        severity: "info",
        code: "settings_not_exported",
        message:
          "Styling, follow-ups and survey settings are not part of the export. Set them up in the editor.",
      },
    ],
  },
};

export const NotesOnly: Story = {
  args: {
    issues: [
      {
        severity: "info",
        code: "settings_not_exported",
        message:
          "Styling, follow-ups and survey settings are not part of the export. Set them up in the editor.",
      },
    ],
  },
};

export const QualtricsLogicReported: Story = {
  args: {
    issues: [
      {
        severity: "info",
        code: "logic_dropped",
        sourceRef: "Q4",
        message: "if 'How did you hear about us?' = 'Other', skip to Q9 'Please specify'",
        vars: { detail: "if 'How did you hear about us?' = 'Other', skip to Q9 'Please specify'" },
      },
      {
        severity: "info",
        code: "logic_dropped",
        sourceRef: "Q12",
        message: "shown only if Q3 = 'Yes'",
        vars: { detail: "shown only if Q3 = 'Yes'" },
      },
      {
        severity: "warning",
        code: "unsupported_question_type",
        sourceRef: "QID7",
        message: "QID7 uses the type 'Timing', which Formbricks does not support. It was not imported.",
        vars: { type: "Timing" },
      },
    ],
  },
};

export const WithErrors: Story = {
  args: {
    issues: [
      {
        severity: "error",
        code: "unknown_element",
        path: "blocks.0.elements.2.type",
        message: "Unknown element type 'hologram'. This file was made by a newer Formbricks version.",
        vars: { type: "hologram" },
      },
    ],
  },
};

export const Empty: Story = { args: { issues: [] } };
