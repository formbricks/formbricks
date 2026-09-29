import { Meta, StoryObj } from "@storybook/react-vite";
import { MakeVisibleToWorkspaceButton, RoleAccessMarker } from "./index";

const meta: Meta<typeof RoleAccessMarker> = {
  title: "Survey/Visibility/RoleAccessMarker",
  component: RoleAccessMarker,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The Created by column's marker on a restricted survey: `role` when the viewer sees it only through their organization role, `author_gone` when its author no longer has an account (the row turns amber and, for someone who can change visibility, offers Make visible).",
      },
    },
  },
  argTypes: {
    kind: {
      control: "select",
      options: ["role", "author_gone"],
      description: "Why the row is marked",
      table: { category: "Appearance", type: { summary: '"role" | "author_gone"' } },
    },
    workspaceName: {
      control: "text",
      description: "The workspace named in the author-gone tooltip",
      table: { category: "Content", type: { summary: "string" } },
    },
  },
  render: (args) => (
    <div className="flex items-center text-sm text-slate-600">
      <span>Ada Lovelace</span>
      <RoleAccessMarker {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof RoleAccessMarker>;

export const Default: Story = {
  args: { kind: "role", workspaceName: "Acme" },
};

export const AuthorGone: Story = {
  args: { kind: "author_gone", workspaceName: "Acme" },
  render: (args) => (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-amber-50 p-4 text-sm text-slate-600">
      <span className="flex items-center">
        <span>-</span>
        <RoleAccessMarker {...args} />
      </span>
      <MakeVisibleToWorkspaceButton workspaceName={args.workspaceName} onClick={() => undefined} />
    </div>
  ),
};

export const AuthorGoneReadOnly: Story = {
  args: { kind: "author_gone", workspaceName: "Acme" },
};

export const MakeVisibleLoading: Story = {
  args: { kind: "author_gone", workspaceName: "Acme" },
  render: (args) => (
    <MakeVisibleToWorkspaceButton workspaceName={args.workspaceName} loading onClick={() => undefined} />
  ),
};
