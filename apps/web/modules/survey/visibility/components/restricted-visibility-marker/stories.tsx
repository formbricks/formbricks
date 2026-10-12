import { Meta, StoryObj } from "@storybook/react-vite";
import { RestrictedVisibilityMarker } from "./index";

const meta: Meta<typeof RestrictedVisibilityMarker> = {
  title: "Survey/Visibility/RestrictedVisibilityMarker",
  component: RestrictedVisibilityMarker,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Marks a restricted survey in the survey list's Name column, the counterpart of the workspace marker. Hover for who can see the survey.",
      },
    },
  },
  argTypes: {
    author: {
      control: "object",
      description: "Who the survey is restricted to besides the organization's owners and managers",
      table: { category: "Content", type: { summary: "TRestrictedAuthor" } },
    },
  },
  render: (args) => (
    <div className="flex items-center text-sm font-medium text-slate-900">
      <RestrictedVisibilityMarker {...args}>
        <div className="truncate">Customer interviews Q3</div>
      </RestrictedVisibilityMarker>
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof RestrictedVisibilityMarker>;

export const Default: Story = {
  args: { author: { kind: "named", name: "Ada Lovelace" } },
};

export const OwnSurvey: Story = {
  args: { author: { kind: "you" } },
};

export const AuthorGone: Story = {
  args: { author: { kind: "unknown" } },
};
