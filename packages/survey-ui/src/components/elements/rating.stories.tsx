import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { Rating, type RatingProps } from "./rating";

// Styling options for the StylingPlayground story
interface StylingOptions {
  // Element styling
  elementHeadlineFontFamily: string;
  elementHeadlineFontSize: string;
  elementHeadlineFontWeight: string;
  elementHeadlineColor: string;
  elementDescriptionFontFamily: string;
  elementDescriptionFontWeight: string;
  elementDescriptionFontSize: string;
  elementDescriptionColor: string;
  // Label styling
  labelFontFamily: string;
  labelFontSize: string;
  labelFontWeight: string;
  labelColor: string;
  labelOpacity: string;
  // Input styling
  inputBgColor: string;
  inputBorderColor: string;
  inputColor: string;
  inputFontWeight: string;
  // Survey styling
  brandColor: string;
}

type StoryProps = RatingProps & Partial<StylingOptions>;

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
    headline: {
      control: "text",
      description: "The main element text",
      table: { category: "Content" },
    },
    description: {
      control: "text",
      description: "Optional description or subheader text",
      table: { category: "Content" },
    },
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
    required: {
      control: "boolean",
      description: "Whether the field is required",
      table: { category: "Validation" },
    },
    errorMessage: {
      control: "text",
      description: "Error message to display",
      table: { category: "Validation" },
    },
    dir: {
      control: { type: "select" },
      options: ["ltr", "rtl", "auto"],
      description: "Text direction for RTL support",
      table: { category: "Layout" },
    },
    disabled: {
      control: "boolean",
      description: "Whether the controls are disabled",
      table: { category: "State" },
    },
    onChange: {
      action: "changed",
      table: { category: "Events" },
    },
  },
  render: function Render(args: StoryProps) {
    const [value, setValue] = useState(args.value);

    useEffect(() => {
      setValue(args.value);
    }, [args.value]);

    return (
      <Rating
        {...args}
        value={value}
        onChange={(v) => {
          setValue(v);
          args.onChange?.(v);
        }}
      />
    );
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args
const withCSSVariables: Decorator<StoryProps> = (Story, context) => {
  const args = context.args as StoryProps;
  const {
    elementHeadlineFontFamily,
    elementHeadlineFontSize,
    elementHeadlineFontWeight,
    elementHeadlineColor,
    elementDescriptionFontFamily,
    elementDescriptionFontSize,
    elementDescriptionFontWeight,
    elementDescriptionColor,
    labelFontFamily,
    labelFontSize,
    labelFontWeight,
    labelColor,
    labelOpacity,
    inputBgColor,
    inputBorderColor,
    inputColor,
    inputFontWeight,
    brandColor,
  } = args;

  const cssVarStyle: React.CSSProperties & Record<string, string | undefined> = {
    "--fb-element-headline-font-family": elementHeadlineFontFamily,
    "--fb-element-headline-font-size": elementHeadlineFontSize,
    "--fb-element-headline-font-weight": elementHeadlineFontWeight,
    "--fb-element-headline-color": elementHeadlineColor,
    "--fb-element-description-font-family": elementDescriptionFontFamily,
    "--fb-element-description-font-size": elementDescriptionFontSize,
    "--fb-element-description-font-weight": elementDescriptionFontWeight,
    "--fb-element-description-color": elementDescriptionColor,
    "--fb-label-font-family": labelFontFamily,
    "--fb-label-font-size": labelFontSize,
    "--fb-label-font-weight": labelFontWeight,
    "--fb-label-color": labelColor,
    "--fb-label-opacity": labelOpacity,
    "--fb-brand-color": brandColor,
    "--fb-input-bg-color": inputBgColor,
    "--fb-input-border-color": inputBorderColor,
    "--fb-input-color": inputColor,
    "--fb-input-font-weight": inputFontWeight,
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

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
    elementHeadlineFontFamily: {
      control: "text",
      table: { category: "Element Styling" },
    },
    elementHeadlineFontSize: {
      control: "text",
      table: { category: "Element Styling" },
    },
    elementHeadlineFontWeight: {
      control: "text",
      table: { category: "Element Styling" },
    },
    elementHeadlineColor: {
      control: "color",
      table: { category: "Element Styling" },
    },
    elementDescriptionFontFamily: {
      control: "text",
      table: { category: "Element Styling" },
    },
    elementDescriptionFontSize: {
      control: "text",
      table: { category: "Element Styling" },
    },
    elementDescriptionFontWeight: {
      control: "text",
      table: { category: "Element Styling" },
    },
    elementDescriptionColor: {
      control: "color",
      table: { category: "Element Styling" },
    },
    labelFontFamily: {
      control: "text",
      table: { category: "Label Styling" },
    },
    labelFontSize: {
      control: "text",
      table: { category: "Label Styling" },
    },
    labelFontWeight: {
      control: "text",
      table: { category: "Label Styling" },
    },
    labelColor: {
      control: "color",
      table: { category: "Label Styling" },
    },
    labelOpacity: {
      control: "text",
      table: { category: "Label Styling" },
    },
    brandColor: {
      control: "color",
      table: { category: "Survey Styling" },
    },
    inputBgColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputBorderColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputFontWeight: {
      control: "text",
      table: { category: "Input Styling" },
    },
  },
  decorators: [withCSSVariables],
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
    inputId: "rating-input-rtl-selection",
    headline: "كيف تقيم تجربتك؟",
    scale: "star",
    range: 5,
    value: 4,
  },
};

export const MultipleElements: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <Rating
        elementId="rating-1"
        inputId="rating-input-1"
        headline="How satisfied are you with our service?"
        scale="number"
        range={5}
        lowerLabel="Not satisfied"
        upperLabel="Very satisfied"
        onChange={() => {}}
      />
      <Rating
        elementId="rating-2"
        inputId="rating-input-2"
        headline="Rate this product"
        description="Please rate from 1 to 5 stars"
        scale="star"
        range={5}
        onChange={() => {}}
      />
      <Rating
        elementId="rating-3"
        inputId="rating-input-3"
        headline="How do you feel?"
        scale="smiley"
        range={5}
        colorCoding
        onChange={() => {}}
      />
    </div>
  ),
};
