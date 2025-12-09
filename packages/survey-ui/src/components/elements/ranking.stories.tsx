import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { Ranking, type RankingOption, type RankingProps } from "./ranking";

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
}

type StoryProps = RankingProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/Ranking",
  component: Ranking,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A ranking element that allows users to order items by clicking them. Users can reorder ranked items using up/down buttons.",
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
    options: {
      control: "object",
      description: "Array of options to rank",
      table: { category: "Content" },
    },
    value: {
      control: "object",
      description: "Currently ranked option IDs in order",
      table: { category: "State" },
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
      <Ranking
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
const withCSSVariables: Decorator<StoryProps> = (Story: any, context: any) => {
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
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

// Default options for stories
const defaultOptions: RankingOption[] = [
  { id: "1", label: "Option 1" },
  { id: "2", label: "Option 2" },
  { id: "3", label: "Option 3" },
  { id: "4", label: "Option 4" },
  { id: "5", label: "Option 5" },
];

export const StylingPlayground: Story = {
  args: {
    elementId: "ranking-1",
    inputId: "ranking-input-1",
    headline: "Rank these items in order of importance",
    description: "Click items to add them to your ranking, then use arrows to reorder",
    options: defaultOptions,
    elementHeadlineFontFamily: "system-ui, sans-serif",
    elementHeadlineFontSize: "1.125rem",
    elementHeadlineFontWeight: "600",
    elementHeadlineColor: "#1e293b",
    elementDescriptionFontFamily: "system-ui, sans-serif",
    elementDescriptionFontSize: "0.875rem",
    elementDescriptionFontWeight: "400",
    elementDescriptionColor: "#64748b",
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
  },
  decorators: [withCSSVariables],
};

export const Default: Story = {
  args: {
    elementId: "ranking-1",
    inputId: "ranking-input-1",
    headline: "Rank these items in order of importance",
    options: defaultOptions,
  },
};

export const WithDescription: Story = {
  args: {
    elementId: "ranking-2",
    inputId: "ranking-input-2",
    headline: "Rank these items in order of importance",
    description: "Click items to add them to your ranking, then use the arrows to reorder them",
    options: defaultOptions,
  },
};

export const WithRanking: Story = {
  args: {
    elementId: "ranking-3",
    inputId: "ranking-input-3",
    headline: "Rank these items in order of importance",
    options: defaultOptions,
    value: ["3", "1", "5"],
  },
};

export const FullyRanked: Story = {
  args: {
    elementId: "ranking-4",
    inputId: "ranking-input-4",
    headline: "Rank these items in order of importance",
    options: defaultOptions,
    value: ["5", "2", "1", "4", "3"],
  },
};

export const Required: Story = {
  args: {
    elementId: "ranking-5",
    inputId: "ranking-input-5",
    headline: "Rank these items in order of importance",
    options: defaultOptions,
    required: true,
  },
};

export const WithError: Story = {
  args: {
    elementId: "ranking-6",
    inputId: "ranking-input-6",
    headline: "Rank these items in order of importance",
    options: defaultOptions,
    required: true,
    errorMessage: "Please rank all items",
  },
};

export const Disabled: Story = {
  args: {
    elementId: "ranking-7",
    inputId: "ranking-input-7",
    headline: "Rank these items in order of importance",
    options: defaultOptions,
    value: ["2", "4"],
    disabled: true,
  },
};

export const ManyOptions: Story = {
  args: {
    elementId: "ranking-8",
    inputId: "ranking-input-8",
    headline: "Rank these features by priority",
    description: "Click to add to ranking, use arrows to reorder",
    options: [
      { id: "1", label: "Feature A" },
      { id: "2", label: "Feature B" },
      { id: "3", label: "Feature C" },
      { id: "4", label: "Feature D" },
      { id: "5", label: "Feature E" },
      { id: "6", label: "Feature F" },
      { id: "7", label: "Feature G" },
      { id: "8", label: "Feature H" },
    ],
  },
};

export const RTL: Story = {
  args: {
    elementId: "ranking-rtl",
    inputId: "ranking-input-rtl",
    headline: "رتب هذه العناصر حسب الأهمية",
    description: "انقر على العناصر لإضافتها إلى الترتيب، ثم استخدم الأسهم لإعادة الترتيب",
    options: [
      { id: "1", label: "الخيار الأول" },
      { id: "2", label: "الخيار الثاني" },
      { id: "3", label: "الخيار الثالث" },
      { id: "4", label: "الخيار الرابع" },
    ],
  },
};

export const RTLWithRanking: Story = {
  args: {
    elementId: "ranking-rtl-ranked",
    inputId: "ranking-input-rtl-ranked",
    headline: "رتب هذه العناصر حسب الأهمية",
    options: [
      { id: "1", label: "الخيار الأول" },
      { id: "2", label: "الخيار الثاني" },
      { id: "3", label: "الخيار الثالث" },
      { id: "4", label: "الخيار الرابع" },
    ],
    value: ["3", "1", "4"],
  },
};

export const MultipleElements: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <Ranking
        elementId="ranking-1"
        inputId="ranking-input-1"
        headline="Rank these features by priority"
        options={defaultOptions}
        onChange={() => {}}
      />
      <Ranking
        elementId="ranking-2"
        inputId="ranking-input-2"
        headline="Rank these products by preference"
        description="Click items to rank them"
        options={[
          { id: "1", label: "Product A" },
          { id: "2", label: "Product B" },
          { id: "3", label: "Product C" },
        ]}
        value={["2", "1"]}
        onChange={() => {}}
      />
    </div>
  ),
};
