import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import {
  type BaseStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  createStatefulRender,
} from "../../lib/story-helpers";
import { PictureSelect, type PictureSelectOption, type PictureSelectProps } from "./picture-select";

type StoryProps = PictureSelectProps &
  Partial<BaseStylingOptions & { optionBorderRadius: string }> &
  Record<string, unknown>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/PictureSelect",
  component: PictureSelect,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete picture selection element that combines headline, description, and a grid of selectable images. Supports both single and multi-select modes, validation, and RTL text direction.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    ...commonArgTypes,
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
  },
  render: createStatefulRender(PictureSelect),
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args

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
    // Element styling
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
    brandColor: {
      control: "color",
      table: { category: "Survey Styling" },
    },
    optionBorderRadius: {
      control: "text",
      description: "Border radius for picture options",
      table: { category: "Option Styling" },
    },
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
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
    headline: "This element is disabled",
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
    dir: "rtl",
    description: "اختر صورة واحدة",
    options: defaultOptions.map((opt) => ({ ...opt, alt: "نص بديل" })),
  },
};

export const RTLWithSelection: Story = {
  args: {
    headline: "اختر الصور التي تعجبك",
    dir: "rtl",
    description: "يمكنك اختيار عدة صور",
    options: defaultOptions.map((opt) => ({ ...opt, alt: "نص بديل" })),
    allowMulti: true,
    value: ["option-1", "option-2"],
  },
};

export const MultipleElements: Story = {
  render: () => {
    const [value1, setValue1] = React.useState<string | string[] | undefined>(undefined);
    const [value2, setValue2] = React.useState<string | string[]>(["option-1", "option-3"]);

    return (
      <div className="w-[600px] space-y-8">
        <PictureSelect
          elementId="picture-1"
          inputId="picture-1-input"
          headline="Which image do you prefer?"
          description="Select one image"
          options={defaultOptions}
          value={value1}
          onChange={setValue1}
        />
        <PictureSelect
          elementId="picture-2"
          inputId="picture-2-input"
          headline="Select all images you like"
          description="You can select multiple images"
          options={defaultOptions}
          allowMulti
          value={value2}
          onChange={setValue2}
        />
      </div>
    );
  },
};
