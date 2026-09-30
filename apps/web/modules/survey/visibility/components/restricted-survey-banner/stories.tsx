import { Meta, StoryObj } from "@storybook/react-vite";
import { RestrictedSurveyBanner } from "./index";

const meta: Meta<typeof RestrictedSurveyBanner> = {
  title: "Survey/Visibility/RestrictedSurveyBanner",
  component: RestrictedSurveyBanner,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Shown on the editor, summary and responses pages to an organization owner or manager who sees a restricted survey only through their role. A warning that cannot be dismissed; the editor renders it as a full-width strip.",
      },
    },
  },
  argTypes: {
    className: {
      control: "text",
      description: "Additional CSS classes",
      table: { category: "Appearance", type: { summary: "string" } },
    },
    ownerName: {
      control: "text",
      description: "The author's name; null when the author no longer has an account",
      table: { category: "Content", type: { summary: "string | null" } },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RestrictedSurveyBanner>;

export const Default: Story = {
  args: { ownerName: "Ada Lovelace" },
};

export const AuthorGone: Story = {
  args: { ownerName: null },
};

export const EditorStrip: Story = {
  args: { ownerName: "Ada Lovelace", className: "rounded-none border-x-0 border-t-0" },
  parameters: { layout: "fullscreen" },
};
