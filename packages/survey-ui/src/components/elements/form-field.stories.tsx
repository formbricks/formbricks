import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React from "react";
import { FormField, type FormFieldConfig, type FormFieldProps } from "./form-field";

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
  // Label styling
  labelFontFamily: string;
  labelFontSize: string;
  labelFontWeight: string;
  labelColor: string;
  // Input styling
  inputWidth: string;
  inputHeight: string;
  inputBgColor: string;
  inputBorderColor: string;
  inputBorderRadius: string;
  inputFontFamily: string;
  inputFontSize: string;
  inputFontWeight: string;
  inputColor: string;
  inputPaddingX: string;
  inputPaddingY: string;
  inputShadow: string;
}

type StoryProps = FormFieldProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/FormField",
  component: FormField,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A flexible form field question element that can display multiple input fields with different configurations. Replaces Contact Info and Address questions.",
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
    fields: {
      control: "object",
      description: "Array of form field configurations",
      table: { category: "Content" },
    },
    value: {
      control: "object",
      description: "Current values as a record mapping field IDs to their values",
      table: { category: "State" },
    },
    required: {
      control: "boolean",
      description: "Whether the entire form is required",
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
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args
const withCSSVariables: Decorator<StoryProps> = (Story, context) => {
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
    labelFontFamily,
    labelFontSize,
    labelFontWeight,
    labelColor,
    inputWidth,
    inputHeight,
    inputBgColor,
    inputBorderColor,
    inputBorderRadius,
    inputFontFamily,
    inputFontSize,
    inputFontWeight,
    inputColor,
    inputPaddingX,
    inputPaddingY,
    inputShadow,
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
    "--fb-label-font-family": labelFontFamily,
    "--fb-label-font-size": labelFontSize,
    "--fb-label-font-weight": labelFontWeight,
    "--fb-label-color": labelColor,
    "--fb-input-width": inputWidth,
    "--fb-input-height": inputHeight,
    "--fb-input-bg-color": inputBgColor,
    "--fb-input-border-color": inputBorderColor,
    "--fb-input-border-radius": inputBorderRadius,
    "--fb-input-font-family": inputFontFamily,
    "--fb-input-font-size": inputFontSize,
    "--fb-input-font-weight": inputFontWeight,
    "--fb-input-color": inputColor,
    "--fb-input-padding-x": inputPaddingX,
    "--fb-input-padding-y": inputPaddingY,
    "--fb-input-shadow": inputShadow,
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

// Contact Info fields preset
const contactInfoFields: FormFieldConfig[] = [
  { id: "firstName", label: "First Name", placeholder: "First Name", required: true, show: true },
  { id: "lastName", label: "Last Name", placeholder: "Last Name", required: true, show: true },
  { id: "email", label: "Email", placeholder: "Email", type: "email", required: true, show: true },
  { id: "phone", label: "Phone", placeholder: "Phone", type: "tel", required: true, show: true },
  { id: "company", label: "Company", placeholder: "Company", required: true, show: true },
];

// Address fields preset
const addressFields: FormFieldConfig[] = [
  { id: "addressLine1", label: "Address Line 1", placeholder: "Address Line 1", required: true, show: true },
  { id: "addressLine2", label: "Address Line 2", placeholder: "Address Line 2", required: true, show: true },
  { id: "city", label: "City", placeholder: "City", required: true, show: true },
  { id: "state", label: "State", placeholder: "State", required: true, show: true },
  { id: "zip", label: "Zip", placeholder: "Zip", required: true, show: true },
  { id: "country", label: "Country", placeholder: "Country", required: true, show: true },
];

export const StylingPlayground: Story = {
  args: {
    elementId: "form-field-1",
    headline: "Please provide your contact information",
    description: "We'll use this to contact you",
    fields: contactInfoFields,
    questionHeadlineFontFamily: "system-ui, sans-serif",
    questionHeadlineFontSize: "1.125rem",
    questionHeadlineFontWeight: "600",
    questionHeadlineColor: "#1e293b",
    questionDescriptionFontFamily: "system-ui, sans-serif",
    questionDescriptionFontSize: "0.875rem",
    questionDescriptionFontWeight: "400",
    questionDescriptionColor: "#64748b",
    labelFontFamily: "system-ui, sans-serif",
    labelFontSize: "0.875rem",
    labelFontWeight: "500",
    labelColor: "#1e293b",
    inputWidth: "100%",
    inputHeight: "auto",
    inputBgColor: "transparent",
    inputBorderColor: "hsl(214.3 31.8% 91.4%)",
    inputBorderRadius: "0.5rem",
    inputFontFamily: "system-ui, sans-serif",
    inputFontSize: "0.875rem",
    inputFontWeight: "400",
    inputColor: "hsl(222.2 84% 4.9%)",
    inputPaddingX: "0.75rem",
    inputPaddingY: "0.5rem",
    inputShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  },
  argTypes: {
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
    inputBorderRadius: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputFontFamily: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputFontSize: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputFontWeight: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputColor: {
      control: "color",
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
    inputShadow: {
      control: "text",
      table: { category: "Input Styling" },
    },
  },
  decorators: [withCSSVariables],
};

export const Default: Story = {
  args: {
    elementId: "form-field-1",
    headline: "Please provide your contact information",
    fields: contactInfoFields,
  },
};

export const WithDescription: Story = {
  args: {
    elementId: "form-field-2",
    headline: "Please provide your contact information",
    description: "We'll use this to contact you about your inquiry",
    fields: contactInfoFields,
  },
};

export const ContactInfo: Story = {
  args: {
    elementId: "form-field-contact",
    headline: "Contact Information",
    description: "Please provide your contact details",
    fields: contactInfoFields,
  },
};

export const Address: Story = {
  args: {
    elementId: "form-field-address",
    headline: "Shipping Address",
    description: "Please provide your shipping address",
    fields: addressFields,
  },
};

export const Required: Story = {
  args: {
    elementId: "form-field-3",
    headline: "Please provide your contact information",
    fields: contactInfoFields,
    required: true,
  },
};

export const WithValues: Story = {
  args: {
    elementId: "form-field-4",
    headline: "Please provide your contact information",
    fields: contactInfoFields,
    value: {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      phone: "+1234567890",
      company: "Acme Inc.",
    },
  },
};

export const WithError: Story = {
  args: {
    elementId: "form-field-5",
    headline: "Please provide your contact information",
    fields: contactInfoFields,
    required: true,
    errorMessage: "Please fill in all required fields",
  },
};

export const Disabled: Story = {
  args: {
    elementId: "form-field-6",
    headline: "Please provide your contact information",
    fields: contactInfoFields,
    disabled: true,
    value: {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
    },
  },
};

export const PartialFields: Story = {
  args: {
    elementId: "form-field-7",
    headline: "Basic Information",
    fields: [
      { id: "firstName", label: "First Name", placeholder: "First Name", required: true, show: true },
      { id: "lastName", label: "Last Name", placeholder: "Last Name", required: true, show: true },
      { id: "email", label: "Email", placeholder: "Email", type: "email", required: false, show: true },
      {
        id: "phone",
        label: "Phone",
        placeholder: "Phone (optional)",
        type: "tel",
        required: false,
        show: false,
      },
    ],
  },
};

export const OptionalFields: Story = {
  args: {
    elementId: "form-field-8",
    headline: "Optional Information",
    fields: [
      { id: "firstName", label: "First Name", placeholder: "First Name", required: false, show: true },
      { id: "lastName", label: "Last Name", placeholder: "Last Name", required: false, show: true },
      { id: "email", label: "Email", placeholder: "Email", type: "email", required: false, show: true },
    ],
    required: false,
  },
};

export const RTL: Story = {
  args: {
    elementId: "form-field-rtl",
    headline: "يرجى تقديم معلومات الاتصال الخاصة بك",
    description: "سنستخدم هذا للاتصال بك",
    fields: [
      { id: "firstName", label: "الاسم الأول", placeholder: "الاسم الأول", required: true, show: true },
      { id: "lastName", label: "اسم العائلة", placeholder: "اسم العائلة", required: true, show: true },
      {
        id: "email",
        label: "البريد الإلكتروني",
        placeholder: "البريد الإلكتروني",
        type: "email",
        required: true,
        show: true,
      },
    ],
  },
};

export const RTLWithValues: Story = {
  args: {
    elementId: "form-field-rtl-values",
    headline: "يرجى تقديم معلومات الاتصال الخاصة بك",
    fields: [
      { id: "firstName", label: "الاسم الأول", placeholder: "الاسم الأول", required: true, show: true },
      { id: "lastName", label: "اسم العائلة", placeholder: "اسم العائلة", required: true, show: true },
      {
        id: "email",
        label: "البريد الإلكتروني",
        placeholder: "البريد الإلكتروني",
        type: "email",
        required: true,
        show: true,
      },
    ],
    value: {
      firstName: "أحمد",
      lastName: "محمد",
      email: "ahmed@example.com",
    },
  },
};

export const MultipleQuestions: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <FormField
        elementId="form-field-1"
        headline="Contact Information"
        description="Please provide your contact details"
        fields={contactInfoFields}
      />
      <FormField
        elementId="form-field-2"
        headline="Shipping Address"
        description="Where should we ship your order?"
        fields={addressFields}
      />
    </div>
  ),
};
