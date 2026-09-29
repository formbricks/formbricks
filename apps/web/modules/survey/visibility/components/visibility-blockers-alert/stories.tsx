import { Meta, StoryObj } from "@storybook/react-vite";
import { VisibilityBlockersAlert } from "./index";

const meta: Meta<typeof VisibilityBlockersAlert> = {
  title: "Survey/Visibility/VisibilityBlockersAlert",
  component: VisibilityBlockersAlert,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The outbound connections that stop a survey from being restricted, grouped by type. Used by the Restrict confirmation and the Collaborate modal; renders nothing without blockers.",
      },
    },
  },
  argTypes: {
    size: {
      control: "select",
      options: ["default", "small"],
      description: "Alert size",
      table: { category: "Appearance", type: { summary: '"default" | "small"' } },
    },
    blockers: {
      control: "object",
      description: "The connections that depend on the survey",
      table: { category: "Content" },
    },
  },
  render: (args) => (
    <div className="w-96">
      <VisibilityBlockersAlert {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof VisibilityBlockersAlert>;

const blockers = [
  { id: "i1", name: "Slack", type: "integration" as const },
  { id: "w1", name: "CRM sync", type: "webhook" as const },
  { id: "f1", name: "Support inbox", type: "feedbackSource" as const },
];

export const Default: Story = { args: { blockers } };

export const Small: Story = { args: { blockers, size: "small" } };

export const NoBlockers: Story = { args: { blockers: [] } };
