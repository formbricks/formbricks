import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React from "react";
import { PictureSelect, type PictureSelectOption, type PictureSelectProps } from "./picture-select";

// Styling options for the StylingPlayground story
interface StylingOptions {
  // Question styling
  questionHeadlineFontFamily: string;
  questionHeadlineFontSize: string;
  questionHeadlineFontWeight: string;
  questionHeadlineColor: string;
  questionDescriptionFontFamily: string;
  questionDescriptionFontWeight: string;
  questionDescriptionFontSize: string;
  questionDescriptionColor: string;
  inputBorderColor: string;
  inputColor: string;
}

type StoryProps = PictureSelectProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/PictureSelect",
  component: PictureSelect,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete picture selection question element that combines headline, description, and a grid of selectable images. Supports both single and multi-select modes, validation, and RTL text direction.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    headline: {
      control: "text",
      description: "The main question text",
      table: { category: "Content" },
    },
    description: {
      control: "text",
      description: "Optional description or subheader text",
      table: { category: "Content" },
    },
    options: {
      control: "object",
      description: "Array of picture options to choose from",
      table: { category: "Content" },
    },
    value: {
      control: "object",
      description: "Selected option ID(s) - string for single select, string[] for multi select",
      table: { category: "State" },
    },
    allowMulti: {
      control: "boolean",
      description: "Whether multiple selections are allowed",
      table: { category: "Behavior" },
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
      description: "Whether the options are disabled",
      table: { category: "State" },
    },
    onChange: {
      action: "changed",
      table: { category: "Events" },
    },
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args
const withCSSVariables: Decorator<StoryProps> = (Story, context) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Storybook's Decorator type doesn't properly infer args type
  const args = context.args as StoryProps;
  const {
    questionHeadlineFontFamily,
    questionHeadlineFontSize,
    questionHeadlineFontWeight,
    questionHeadlineColor,
    questionDescriptionFontFamily,
    questionDescriptionFontSize,
    questionDescriptionFontWeight,
    questionDescriptionColor,
    inputBorderColor,
    inputColor,
  } = args;

  const cssVarStyle: React.CSSProperties & Record<string, string | undefined> = {
    "--fb-question-headline-font-family": questionHeadlineFontFamily,
    "--fb-question-headline-font-size": questionHeadlineFontSize,
    "--fb-question-headline-font-weight": questionHeadlineFontWeight,
    "--fb-question-headline-color": questionHeadlineColor,
    "--fb-question-description-font-family": questionDescriptionFontFamily,
    "--fb-question-description-font-size": questionDescriptionFontSize,
    "--fb-question-description-font-weight": questionDescriptionFontWeight,
    "--fb-question-description-color": questionDescriptionColor,
    "--fb-input-border-color": inputBorderColor,
    "--fb-input-color": inputColor,
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

// Sample image URLs - using placeholder images
const defaultOptions: PictureSelectOption[] = [
  {
    id: "option-1",
    imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop",
    alt: "Mountain landscape",
  },
  {
    id: "option-2",
    imageUrl: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=300&h=200&fit=crop",
    alt: "Ocean view",
  },
  {
    id: "option-3",
    imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=200&fit=crop",
    alt: "Forest path",
  },
  {
    id: "option-4",
    imageUrl: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=300&h=200&fit=crop",
    alt: "Desert scene",
  },
];

export const StylingPlayground: Story = {
  args: {
    headline: "Which image do you prefer?",
    description: "Select one or more images",
    options: defaultOptions,
    allowMulti: false,
  },
  argTypes: {
    // Question styling
    questionHeadlineFontFamily: {
      control: "text",
      table: { category: "Question Styling" },
    },
    questionHeadlineFontSize: {
      control: "text",
      table: { category: "Question Styling" },
    },
    questionHeadlineFontWeight: {
      control: "text",
      table: { category: "Question Styling" },
    },
    questionHeadlineColor: {
      control: "color",
      table: { category: "Question Styling" },
    },
    questionDescriptionFontFamily: {
      control: "text",
      table: { category: "Question Styling" },
    },
    questionDescriptionFontSize: {
      control: "text",
      table: { category: "Question Styling" },
    },
    questionDescriptionFontWeight: {
      control: "text",
      table: { category: "Question Styling" },
    },
    questionDescriptionColor: {
      control: "color",
      table: { category: "Question Styling" },
    },
    // Input styling
    inputBorderColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
  },
  decorators: [withCSSVariables],
};

export const Default: Story = {
  args: {
    headline: "Which image do you prefer?",
    options: defaultOptions,
  },
};

export const WithDescription: Story = {
  args: {
    headline: "Select your favorite travel destination",
    description: "Choose the image that appeals to you most",
    options: defaultOptions,
  },
};

export const SingleSelect: Story = {
  args: {
    headline: "Which image do you prefer?",
    description: "Select one image",
    options: defaultOptions,
    allowMulti: false,
  },
};

export const MultiSelect: Story = {
  args: {
    headline: "Select all images you like",
    description: "You can select multiple images",
    options: defaultOptions,
    allowMulti: true,
  },
};

export const Required: Story = {
  args: {
    headline: "Which image do you prefer?",
    description: "Please select an image",
    options: defaultOptions,
    required: true,
  },
};

export const WithSelection: Story = {
  args: {
    headline: "Which image do you prefer?",
    options: defaultOptions,
    value: "option-2",
  },
};

export const WithMultipleSelections: Story = {
  args: {
    headline: "Select all images you like",
    description: "You can select multiple images",
    options: defaultOptions,
    allowMulti: true,
    value: ["option-1", "option-3"],
  },
};

export const WithError: Story = {
  args: {
    headline: "Which image do you prefer?",
    description: "Please select an image",
    options: defaultOptions,
    errorMessage: "Please select at least one image",
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    headline: "This question is disabled",
    description: "You cannot change the selection",
    options: defaultOptions,
    value: "option-2",
    disabled: true,
  },
};

export const ManyOptions: Story = {
  args: {
    headline: "Select your favorite images",
    description: "Choose from the images below",
    options: [
      ...defaultOptions,
      {
        id: "option-5",
        imageUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300&h=200&fit=crop",
        alt: "City skyline",
      },
      {
        id: "option-6",
        imageUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&h=200&fit=crop",
        alt: "Sunset",
      },
    ],
    allowMulti: true,
  },
};

export const RTL: Story = {
  args: {
    headline: "ما هي الصورة التي تفضلها؟",
    description: "اختر صورة واحدة",
    options: defaultOptions.map((opt) => ({ ...opt, alt: "نص بديل" })),
  },
};

export const RTLWithSelection: Story = {
  args: {
    headline: "اختر الصور التي تعجبك",
    description: "يمكنك اختيار عدة صور",
    options: defaultOptions.map((opt) => ({ ...opt, alt: "نص بديل" })),
    allowMulti: true,
    value: ["option-1", "option-2"],
  },
};

export const MultipleQuestions: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <PictureSelect
        elementId="picture-1"
        inputId="picture-1-input"
        headline="Which image do you prefer?"
        description="Select one image"
        options={defaultOptions}
        onChange={() => {}}
      />
      <PictureSelect
        elementId="picture-2"
        inputId="picture-2-input"
        headline="Select all images you like"
        description="You can select multiple images"
        options={defaultOptions}
        allowMulti={true}
        value={["option-1", "option-3"]}
        onChange={() => {}}
      />
    </div>
  ),
};
