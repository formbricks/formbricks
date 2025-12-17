import type { Meta, StoryObj } from "@storybook/react";
import {
  type BaseStylingOptions,
  type OptionStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  createStatefulRender,
  elementStylingArgTypes,
  optionStylingArgTypes,
  surveyStylingArgTypes,
} from "../../lib/story-helpers";
import { Ranking, type RankingOption, type RankingProps } from "./ranking";

type StoryProps = RankingProps & Partial<BaseStylingOptions & OptionStylingOptions> & Record<string, unknown>;

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
    ...commonArgTypes,
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
  },
  render: createStatefulRender(Ranking),
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args

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
  },
  argTypes: {
    ...elementStylingArgTypes,
    ...optionStylingArgTypes,
    ...surveyStylingArgTypes,
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
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
    dir: "rtl",
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
    dir: "rtl",
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
