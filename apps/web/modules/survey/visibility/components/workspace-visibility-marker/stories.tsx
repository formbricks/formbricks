import { Meta, StoryObj } from "@storybook/react-vite";
import { WorkspaceVisibilityMarker } from "./index";

const meta: Meta<typeof WorkspaceVisibilityMarker> = {
  title: "Survey/Visibility/WorkspaceVisibilityMarker",
  component: WorkspaceVisibilityMarker,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Marks a workspace-visible survey in the survey list's Name column. Restricted surveys carry no marker. Hover for the tooltip with its description.",
      },
    },
  },
  argTypes: {
    workspaceName: {
      control: "text",
      description: "The workspace named in the tooltip and the accessible name",
      table: { category: "Content", type: { summary: "string" } },
    },
    children: {
      control: false,
      description: "The survey name the marker precedes",
      table: { category: "Content", type: { summary: "ReactNode" } },
    },
  },
  render: (args) => (
    <div className="flex w-72 items-center text-sm font-medium text-slate-900">
      <WorkspaceVisibilityMarker {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof WorkspaceVisibilityMarker>;

export const Default: Story = {
  args: {
    workspaceName: "Acme",
    children: <div className="w-full truncate">Customer satisfaction Q3</div>,
  },
};

export const LongSurveyName: Story = {
  args: {
    workspaceName: "A workspace with a rather long name",
    children: (
      <div className="w-full truncate">
        A survey whose name is far too long to fit in the Name column at all
      </div>
    ),
  },
};
