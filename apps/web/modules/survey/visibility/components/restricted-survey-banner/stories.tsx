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
          "Shown on the editor, summary and responses pages to an organization owner or manager who sees a restricted survey only through their role. Dismissing it lasts for this survey for the rest of the browser session.",
      },
    },
  },
  argTypes: {
    surveyId: {
      control: "text",
      description: "Keys the per-session dismissal",
      table: { category: "Behavior", type: { summary: "string" } },
    },
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
  args: { surveyId: "story-survey-1", ownerName: "Ada Lovelace" },
};

export const AuthorGone: Story = {
  args: { surveyId: "story-survey-2", ownerName: null },
};
