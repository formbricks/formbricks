import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
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
import { Rating, type RatingProps } from "./rating";

type StoryProps = RatingProps & Partial<BaseStylingOptions & LabelStylingOptions> & Record<string, unknown>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/Rating",
  component: Rating,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A rating element that supports number, star, and smiley scales. Users can select a rating from 1 to the specified range.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    ...commonArgTypes,
    scale: {
      control: { type: "select" },
      options: ["number", "star", "smiley"],
      description: "Rating scale type",
      table: { category: "Content" },
    },
    range: {
      control: { type: "select" },
      options: [3, 4, 5, 6, 7, 10],
      description: "Number of rating options",
      table: { category: "Content" },
    },
    value: {
      control: { type: "number", min: 1 },
      description: "Currently selected rating value",
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
      description: "Whether color coding is enabled (for smiley scale)",
      table: { category: "Content" },
    },
  },
  render: createStatefulRender(Rating),
};

export default meta;
type Story = StoryObj<StoryProps>;

export const StylingPlayground: Story = {
  args: {
    elementId: "rating-1",
    inputId: "rating-input-1",
    headline: "How satisfied are you?",
    description: "Please rate your experience",
    scale: "number",
    range: 5,
    lowerLabel: "Not satisfied",
    upperLabel: "Very satisfied",
    elementHeadlineFontFamily: "system-ui, sans-serif",
    elementHeadlineFontSize: "1.125rem",
    elementHeadlineFontWeight: "600",
    elementHeadlineColor: "#1e293b",
    elementDescriptionFontFamily: "system-ui, sans-serif",
    elementDescriptionFontSize: "0.875rem",
    elementDescriptionFontWeight: "400",
    elementDescriptionColor: "#64748b",
    labelFontFamily: "system-ui, sans-serif",
    labelFontSize: "0.75rem",
    labelFontWeight: "400",
    labelColor: "#64748b",
    labelOpacity: "1",
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
    elementId: "rating-1",
    inputId: "rating-input-1",
    headline: "How satisfied are you?",
    scale: "number",
    range: 5,
  },
};

export const WithDescription: Story = {
  args: {
    elementId: "rating-2",
    inputId: "rating-input-2",
    headline: "How satisfied are you?",
    description: "Please rate your experience from 1 to 5",
    scale: "number",
    range: 5,
  },
};

export const NumberScale: Story = {
  args: {
    elementId: "rating-number",
    inputId: "rating-input-number",
    headline: "Rate your experience",
    scale: "number",
    range: 5,
  },
};

export const StarScale: Story = {
  args: {
    elementId: "rating-star",
    inputId: "rating-input-star",
    headline: "Rate this product",
    scale: "star",
    range: 5,
  },
};

export const SmileyScale: Story = {
  args: {
    elementId: "rating-smiley",
    inputId: "rating-input-smiley",
    headline: "How do you feel?",
    scale: "smiley",
    range: 5,
  },
};

export const WithLabels: Story = {
  args: {
    elementId: "rating-labels",
    inputId: "rating-input-labels",
    headline: "Rate your experience",
    scale: "number",
    range: 5,
    lowerLabel: "Not satisfied",
    upperLabel: "Very satisfied",
  },
};

export const WithSelection: Story = {
  args: {
    elementId: "rating-selection",
    inputId: "rating-input-selection",
    headline: "Rate your experience",
    scale: "number",
    range: 5,
    value: 4,
  },
};

export const Required: Story = {
  args: {
    elementId: "rating-required",
    inputId: "rating-input-required",
    headline: "Rate your experience",
    scale: "number",
    range: 5,
    required: true,
  },
};

export const WithError: Story = {
  args: {
    elementId: "rating-error",
    inputId: "rating-input-error",
    headline: "Rate your experience",
    scale: "number",
    range: 5,
    required: true,
    errorMessage: "Please select a rating",
  },
};

export const Disabled: Story = {
  args: {
    elementId: "rating-disabled",
    inputId: "rating-input-disabled",
    headline: "Rate your experience",
    scale: "number",
    range: 5,
    value: 3,
    disabled: true,
  },
};

export const Range3: Story = {
  args: {
    elementId: "rating-range3",
    inputId: "rating-input-range3",
    headline: "Rate your experience",
    scale: "number",
    range: 3,
  },
};

export const Range10: Story = {
  args: {
    elementId: "rating-range10",
    inputId: "rating-input-range10",
    headline: "Rate your experience",
    scale: "number",
    range: 10,
  },
};

export const ColorCoding: Story = {
  args: {
    elementId: "rating-color",
    inputId: "rating-input-color",
    headline: "How do you feel?",
    scale: "smiley",
    range: 5,
    colorCoding: true,
  },
};

export const RTL: Story = {
  args: {
    elementId: "rating-rtl",
    dir: "rtl",
    inputId: "rating-input-rtl",
    headline: "كيف تقيم تجربتك؟",
    description: "يرجى تقييم تجربتك من 1 إلى 5",
    scale: "number",
    range: 5,
    lowerLabel: "غير راض",
    upperLabel: "راض جداً",
  },
};

export const RTLWithSelection: Story = {
  args: {
    elementId: "rating-rtl-selection",
    dir: "rtl",
    inputId: "rating-input-rtl-selection",
    headline: "كيف تقيم تجربتك؟",
    scale: "star",
    range: 5,
    value: 4,
  },
};

export const MultipleElements: Story = {
  render: () => {
    const [value1, setValue1] = React.useState<number | undefined>(undefined);
    const [value2, setValue2] = React.useState<number | undefined>(undefined);
    const [value3, setValue3] = React.useState<number | undefined>(undefined);

    return (
      <div className="w-[600px] space-y-8">
        <Rating
          elementId="rating-1"
          inputId="rating-input-1"
          headline="How satisfied are you with our service?"
          scale="number"
          range={5}
          lowerLabel="Not satisfied"
          upperLabel="Very satisfied"
          value={value1}
          onChange={setValue1}
        />
        <Rating
          elementId="rating-2"
          inputId="rating-input-2"
          headline="Rate this product"
          description="Please rate from 1 to 5 stars"
          scale="star"
          range={5}
          value={value2}
          onChange={setValue2}
        />
        <Rating
          elementId="rating-3"
          inputId="rating-input-3"
          headline="How do you feel?"
          scale="smiley"
          range={5}
          colorCoding
          value={value3}
          onChange={setValue3}
        />
      </div>
    );
  },
};
