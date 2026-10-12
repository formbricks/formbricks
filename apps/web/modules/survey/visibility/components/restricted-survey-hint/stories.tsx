import { Meta, StoryObj } from "@storybook/react-vite";
import { RestrictedSurveyHint } from "./index";

const meta: Meta<typeof RestrictedSurveyHint> = {
  title: "Survey/Visibility/RestrictedSurveyHint",
  component: RestrictedSurveyHint,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The mark outbound surfaces put on a restricted survey: `restricted` on a picker option that cannot be attached, `paused` on a connection whose restricted survey dispatch skips. The reason is in the tooltip.",
      },
    },
  },
  argTypes: {
    kind: {
      control: "select",
      options: ["restricted", "paused"],
      description: "Where the mark sits",
      table: { category: "Appearance", type: { summary: '"restricted" | "paused"' } },
    },
  },
  render: (args) => (
    <div className="flex items-center gap-x-2 text-sm text-slate-600">
      <span>Customer onboarding survey</span>
      <RestrictedSurveyHint {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof RestrictedSurveyHint>;

export const Default: Story = { args: { kind: "restricted" } };

export const Paused: Story = { args: { kind: "paused" } };
