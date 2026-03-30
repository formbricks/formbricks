import type { Meta, StoryObj } from "@storybook/react";
import {
  type BaseStylingOptions,
  type InputLayoutStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  createStatefulRender,
  elementStylingArgTypes,
  surveyStylingArgTypes,
} from "../../lib/story-helpers";
import { DateElement, type DateElementProps } from "./date";

type StoryProps = DateElementProps &
  Partial<BaseStylingOptions & Pick<InputLayoutStylingOptions, "inputBorderRadius">> &
  Record<string, unknown>;

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
    ...commonArgTypes,
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
  },
  render: createStatefulRender(DateElement),
};

export default meta;
type Story = StoryObj<StoryProps>;

export const StylingPlayground: Story = {
  args: {
    headline: "What is your date of birth?",
    description: "Please select a date",
  },
  argTypes: {
    ...elementStylingArgTypes,
    ...surveyStylingArgTypes,
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
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
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
    dir: "rtl",
  },
};

export const RTLWithValue: Story = {
  args: {
    headline: "ما هو تاريخ ميلادك؟",
    description: "يرجى اختيار تاريخ",
    value: "1990-01-15",
    dir: "rtl",
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
