import type { Meta, StoryObj } from "@storybook/react";
import {
  type BaseStylingOptions,
  type InputLayoutStylingOptions,
  type LabelStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  createStatefulRender,
} from "../../lib/story-helpers";
import { FormField, type FormFieldConfig, type FormFieldProps } from "./form-field";

type StoryProps = FormFieldProps &
  Partial<BaseStylingOptions & LabelStylingOptions & InputLayoutStylingOptions & { inputShadow: string }> &
  Record<string, unknown>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/FormField",
  component: FormField,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A flexible form field element that can display multiple input fields with different configurations. Replaces Contact Info and Address elements.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    ...commonArgTypes,
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
  },
  render: createStatefulRender(FormField),
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args

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
    brandColor: {
      control: "color",
      table: { category: "Survey Styling" },
    },
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
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
    dir: "rtl",
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
    dir: "rtl",
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

export const MultipleElements: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <FormField
        elementId="form-field-1"
        headline="Contact Information"
        description="Please provide your contact details"
        fields={contactInfoFields}
        onChange={() => {}}
      />
      <FormField
        elementId="form-field-2"
        headline="Shipping Address"
        description="Where should we ship your order?"
        fields={addressFields}
        onChange={() => {}}
      />
    </div>
  ),
};
