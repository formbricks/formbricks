import type { Meta, StoryObj } from "@storybook/react";
import {
  type BaseStylingOptions,
  type LabelStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  createStatefulRender,
  elementStylingArgTypes,
  inputStylingArgTypes,
  labelStylingArgTypes,
  pickArgTypes,
  surveyStylingArgTypes,
} from "../../lib/story-helpers";
import { NPS, type NPSProps } from "./nps";

type StoryProps = NPSProps & Partial<BaseStylingOptions & LabelStylingOptions> & Record<string, unknown>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/NPS",
  component: NPS,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A Net Promoter Score (NPS) element. Users can select a rating from 0 to 10 to indicate how likely they are to recommend something.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    ...commonArgTypes,
    value: {
      control: { type: "number", min: 0, max: 10 },
      description: "Currently selected NPS value (0-10)",
      table: { category: "State" },
    },
    lowerLabel: {
      control: "text",
      description: "Label for the lower end of the scale",
      table: { category: "Content" },
    },
    upperLabel: {
      control: "text",
      description: "Label for the upper end of the scale",
      table: { category: "Content" },
    },
    colorCoding: {
      control: "boolean",
      description: "Whether color coding is enabled",
      table: { category: "Content" },
    },
  },
  render: createStatefulRender(NPS),
};

export default meta;
type Story = StoryObj<StoryProps>;

export const StylingPlayground: Story = {
  args: {
    elementId: "nps-1",
    inputId: "nps-input-1",
    headline: "How likely are you to recommend us to a friend or colleague?",
    description: "Please rate from 0 to 10",
    lowerLabel: "Not at all likely",
    upperLabel: "Extremely likely",
  },
  argTypes: {
    ...elementStylingArgTypes,
    ...labelStylingArgTypes,
    ...pickArgTypes(inputStylingArgTypes, [
      "inputBgColor",
      "inputBorderColor",
      "inputColor",
      "inputFontWeight",
      "inputBorderRadius",
    ]),
    ...surveyStylingArgTypes,
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
};

export const Default: Story = {
  args: {
    elementId: "nps-1",
    inputId: "nps-input-1",
    headline: "How likely are you to recommend us to a friend or colleague?",
  },
};

export const WithDescription: Story = {
  args: {
    elementId: "nps-2",
    inputId: "nps-input-2",
    headline: "How likely are you to recommend us to a friend or colleague?",
    description: "Please rate from 0 to 10, where 0 is not at all likely and 10 is extremely likely",
  },
};

export const WithLabels: Story = {
  args: {
    elementId: "nps-labels",
    inputId: "nps-input-labels",
    headline: "How likely are you to recommend us to a friend or colleague?",
    lowerLabel: "Not at all likely",
    upperLabel: "Extremely likely",
  },
};

export const WithSelection: Story = {
  args: {
    elementId: "nps-selection",
    inputId: "nps-input-selection",
    headline: "How likely are you to recommend us to a friend or colleague?",
    value: 9,
  },
};

export const Required: Story = {
  args: {
    elementId: "nps-required",
    inputId: "nps-input-required",
    headline: "How likely are you to recommend us to a friend or colleague?",
    required: true,
  },
};

export const WithError: Story = {
  args: {
    elementId: "nps-error",
    inputId: "nps-input-error",
    headline: "How likely are you to recommend us to a friend or colleague?",
    required: true,
    errorMessage: "Please select a rating",
  },
};

export const Disabled: Story = {
  args: {
    elementId: "nps-disabled",
    inputId: "nps-input-disabled",
    headline: "How likely are you to recommend us to a friend or colleague?",
    value: 8,
    disabled: true,
  },
};

export const ColorCoding: Story = {
  args: {
    elementId: "nps-color",
    inputId: "nps-input-color",
    headline: "How likely are you to recommend us to a friend or colleague?",
    colorCoding: true,
    lowerLabel: "Not at all likely",
    upperLabel: "Extremely likely",
  },
};

export const Promoter: Story = {
  args: {
    elementId: "nps-promoter",
    inputId: "nps-input-promoter",
    headline: "How likely are you to recommend us to a friend or colleague?",
    value: 9,
    colorCoding: true,
    lowerLabel: "Not at all likely",
    upperLabel: "Extremely likely",
  },
};

export const Passive: Story = {
  args: {
    elementId: "nps-passive",
    inputId: "nps-input-passive",
    headline: "How likely are you to recommend us to a friend or colleague?",
    value: 7,
    colorCoding: true,
    lowerLabel: "Not at all likely",
    upperLabel: "Extremely likely",
  },
};

export const Detractor: Story = {
  args: {
    elementId: "nps-detractor",
    inputId: "nps-input-detractor",
    headline: "How likely are you to recommend us to a friend or colleague?",
    value: 5,
    colorCoding: true,
    lowerLabel: "Not at all likely",
    upperLabel: "Extremely likely",
  },
};

export const RTL: Story = {
  args: {
    elementId: "nps-rtl",
    dir: "rtl",
    inputId: "nps-input-rtl",
    headline: "ما مدى احتمالية أن توصي بنا لصديق أو زميل؟",
    description: "يرجى التقييم من 0 إلى 10",
    lowerLabel: "غير محتمل على الإطلاق",
    upperLabel: "محتمل للغاية",
  },
};

export const RTLWithSelection: Story = {
  args: {
    elementId: "nps-rtl-selection",
    dir: "rtl",
    inputId: "nps-input-rtl-selection",
    headline: "ما مدى احتمالية أن توصي بنا لصديق أو زميل؟",
    value: 8,
    lowerLabel: "غير محتمل على الإطلاق",
    upperLabel: "محتمل للغاية",
  },
};

export const MultipleElements: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <NPS
        elementId="nps-1"
        inputId="nps-input-1"
        headline="How likely are you to recommend our product?"
        lowerLabel="Not at all likely"
        upperLabel="Extremely likely"
        onChange={() => {}}
      />
      <NPS
        elementId="nps-2"
        inputId="nps-input-2"
        headline="How likely are you to recommend our service?"
        description="Please rate from 0 to 10"
        value={9}
        colorCoding
        lowerLabel="Not at all likely"
        upperLabel="Extremely likely"
        onChange={() => {}}
      />
    </div>
  ),
};
