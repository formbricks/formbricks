import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { DateElement, type DateElementProps } from "./date";

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
  // Input styling
  inputBgColor: string;
  inputBorderColor: string;
  inputBorderRadius: string;
  inputColor: string;
  //brand color
  brandColor: string;
}

type StoryProps = DateElementProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/Date",
  component: DateElement,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete date element that combines headline, description, and a date input. Supports date range constraints, validation, and RTL text direction.",
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
    value: {
      control: "text",
      description: "Current date value in ISO format (YYYY-MM-DD)",
      table: { category: "State" },
    },
    minDate: {
      control: "text",
      description: "Minimum date allowed (ISO format: YYYY-MM-DD)",
      table: { category: "Validation" },
    },
    maxDate: {
      control: "text",
      description: "Maximum date allowed (ISO format: YYYY-MM-DD)",
      table: { category: "Validation" },
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
      description: "Whether the date input is disabled",
      table: { category: "State" },
    },
    locale: {
      control: { type: "select" },
      options: [
        "en",
        "de",
        "fr",
        "es",
        "ja",
        "pt",
        "pt-BR",
        "ro",
        "zh-Hans",
        "zh-Hant",
        "nl",
        "ar",
        "it",
        "ru",
        "uz",
        "hi",
      ],
      description: "Locale code for date formatting (survey language codes: 'en', 'de', 'ar', etc.)",
      table: { category: "Localization" },
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
      <DateElement
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Storybook's Decorator type doesn't properly infer args type
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
    inputBgColor,
    inputBorderColor,
    inputBorderRadius,
    inputColor,
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
    "--fb-input-bg-color": inputBgColor,
    "--fb-input-color": inputColor,
    "--fb-input-border-color": inputBorderColor,
    "--fb-input-border-radius": inputBorderRadius,
    "--fb-brand-default": brandColor,
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

export const StylingPlayground: Story = {
  args: {
    headline: "What is your date of birth?",
    description: "Please select a date",
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
    // Input styling
    inputWidth: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputHeight: {
      control: "text",
      table: { category: "Input Styling" },
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
    inputBorderRadius: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputFontSize: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputPaddingX: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputPaddingY: {
      control: "text",
      table: { category: "Input Styling" },
    },
  },
  decorators: [withCSSVariables],
};

export const Default: Story = {
  args: {
    headline: "What is your date of birth?",
  },
};

export const WithDescription: Story = {
  args: {
    headline: "When would you like to schedule the appointment?",
    description: "Please select a date for your appointment",
  },
};

export const Required: Story = {
  args: {
    headline: "What is your date of birth?",
    description: "Please select your date of birth",
    required: true,
  },
};

export const WithValue: Story = {
  args: {
    headline: "What is your date of birth?",
    value: "1990-01-15",
  },
};

export const WithDateRange: Story = {
  args: {
    headline: "Select a date for your event",
    description: "Please choose a date between today and next year",
    minDate: new Date().toISOString().split("T")[0],
    maxDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
  },
};

export const WithError: Story = {
  args: {
    headline: "What is your date of birth?",
    description: "Please select your date of birth",
    errorMessage: "Please select a valid date",
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    headline: "This date field is disabled",
    description: "You cannot change the date",
    value: "2024-01-15",
    disabled: true,
  },
};

export const PastDatesOnly: Story = {
  args: {
    headline: "When did you start your current job?",
    description: "Select a date in the past",
    maxDate: new Date().toISOString().split("T")[0],
  },
};

export const FutureDatesOnly: Story = {
  args: {
    headline: "When would you like to schedule the meeting?",
    description: "Select a date in the future",
    minDate: new Date().toISOString().split("T")[0],
  },
};

export const RTL: Story = {
  args: {
    headline: "ما هو تاريخ ميلادك؟",
    description: "يرجى اختيار تاريخ",
  },
};

export const RTLWithValue: Story = {
  args: {
    headline: "ما هو تاريخ ميلادك؟",
    description: "يرجى اختيار تاريخ",
    value: "1990-01-15",
  },
};

export const MultipleElements: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <DateElement
        elementId="date-1"
        inputId="date-1-input"
        headline="What is your date of birth?"
        description="Please select your date of birth"
        onChange={() => {}}
      />
      <DateElement
        elementId="date-2"
        inputId="date-2-input"
        headline="When would you like to schedule the appointment?"
        value="2024-12-25"
        onChange={() => {}}
      />
    </div>
  ),
};

export const WithLocale: Story = {
  args: {
    headline: "What is your date of birth?",
    description: "Date picker with locale-specific formatting",
    locale: "en",
  },
};

export const LocaleExamples: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <div>
        <h3 className="mb-4 text-sm font-semibold">English (en)</h3>
        <DateElement
          elementId="date-en"
          inputId="date-en-input"
          headline="What is your date of birth?"
          locale="en"
          value="2024-12-25"
          onChange={() => {}}
        />
      </div>
      <div>
        <h3 className="mb-4 text-sm font-semibold">German (de)</h3>
        <DateElement
          elementId="date-de"
          inputId="date-de-input"
          headline="Was ist Ihr Geburtsdatum?"
          locale="de"
          value="2024-12-25"
          onChange={() => {}}
        />
      </div>
      <div>
        <h3 className="mb-4 text-sm font-semibold">French (fr)</h3>
        <DateElement
          elementId="date-fr"
          inputId="date-fr-input"
          headline="Quelle est votre date de naissance ?"
          locale="fr"
          value="2024-12-25"
          onChange={() => {}}
        />
      </div>
      <div>
        <h3 className="mb-4 text-sm font-semibold">Spanish (es)</h3>
        <DateElement
          elementId="date-es"
          inputId="date-es-input"
          headline="¿Cuál es su fecha de nacimiento?"
          locale="es"
          value="2024-12-25"
          onChange={() => {}}
        />
      </div>
      <div>
        <h3 className="mb-4 text-sm font-semibold">Japanese (ja)</h3>
        <DateElement
          elementId="date-ja"
          inputId="date-ja-input"
          headline="生年月日を教えてください"
          locale="ja"
          value="2024-12-25"
          onChange={() => {}}
        />
      </div>
      <div>
        <h3 className="mb-4 text-sm font-semibold">Arabic (ar)</h3>
        <DateElement
          elementId="date-ar"
          inputId="date-ar-input"
          headline="ما هو تاريخ ميلادك؟"
          locale="ar"
          value="2024-12-25"
          onChange={() => {}}
        />
      </div>
      <div>
        <h3 className="mb-4 text-sm font-semibold">Russian (ru)</h3>
        <DateElement
          elementId="date-ru"
          inputId="date-ru-input"
          headline="Какова ваша дата рождения?"
          locale="ru"
          value="2024-12-25"
          onChange={() => {}}
        />
      </div>
      <div>
        <h3 className="mb-4 text-sm font-semibold">Chinese Simplified (zh-Hans)</h3>
        <DateElement
          elementId="date-zh"
          inputId="date-zh-input"
          headline="您的出生日期是什么？"
          locale="zh-Hans"
          value="2024-12-25"
          onChange={() => {}}
        />
      </div>
    </div>
  ),
};
