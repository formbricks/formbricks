import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImportFacts } from "./index";

const meta: Meta<typeof ImportFacts> = {
  title: "Surveys/Import/ImportFacts",
  component: ImportFacts,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The facts row above the import review list: question, block and ending counts, the languages found, logic rules, and the source format.",
      },
    },
  },
  argTypes: {
    summary: {
      control: "object",
      description: "Counts from the import report",
      table: { category: "Content" },
    },
    source: { control: "object", description: "Source lane and kind", table: { category: "Content" } },
    className: { control: "text", table: { category: "Appearance" } },
  },
};

export default meta;
type Story = StoryObj<typeof ImportFacts>;

export const Default: Story = {
  args: {
    summary: {
      blocks: 3,
      elements: 12,
      endings: 1,
      languages: ["en-US", "de-DE"],
      logicRules: 2,
      logicRulesReported: 0,
      hiddenFields: 1,
    },
    source: { lane: "lossless", kind: "formbricks-export" },
  },
};

export const QualtricsWithReportedLogic: Story = {
  args: {
    summary: {
      blocks: 9,
      elements: 150,
      endings: 1,
      languages: ["en-US", "de-DE", "fr-FR"],
      logicRules: 0,
      logicRulesReported: 14,
      hiddenFields: 3,
    },
    source: { lane: "structured", kind: "qsf" },
  },
};

export const SingleQuestion: Story = {
  args: {
    summary: {
      blocks: 1,
      elements: 1,
      endings: 0,
      languages: ["en-US"],
      logicRules: 0,
      logicRulesReported: 0,
      hiddenFields: 0,
    },
  },
};
