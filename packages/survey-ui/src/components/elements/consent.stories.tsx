import type { Meta, StoryObj } from "@storybook/react";
import {
  type BaseStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  createStatefulRender,
  elementStylingArgTypes,
  inputStylingArgTypes,
  pickArgTypes,
  surveyStylingArgTypes,
} from "../../lib/story-helpers";
import { Consent, type ConsentProps } from "./consent";

type StoryProps = ConsentProps & Partial<BaseStylingOptions> & Record<string, unknown>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/Consent",
  component: Consent,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A consent element that displays a checkbox for users to accept terms, conditions, or agreements.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    ...commonArgTypes,
    checkboxLabel: {
      control: "text",
      description: "Label text for the consent checkbox",
      table: { category: "Content" },
    },
    value: {
      control: "boolean",
      description: "Whether consent is checked",
      table: { category: "State" },
    },
  },
  render: createStatefulRender(Consent),
};

export default meta;
type Story = StoryObj<StoryProps>;

export const StylingPlayground: Story = {
  args: {
    elementId: "consent-1",
    inputId: "consent-input-1",
    headline: "Terms and Conditions",
    description: "Please read and accept the terms",
    checkboxLabel: "I agree to the terms and conditions",
    onChange: () => {},
  },
  argTypes: {
    ...elementStylingArgTypes,
    ...pickArgTypes(inputStylingArgTypes, [
      "inputBgColor",
      "inputBorderColor",
      "inputColor",
      "inputFontSize",
      "inputFontWeight",
      "inputWidth",
      "inputBorderRadius",
      "inputPaddingX",
      "inputPaddingY",
    ]),
    ...surveyStylingArgTypes,
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
};

export const Default: Story = {
  args: {
    elementId: "consent-1",
    inputId: "consent-input-1",
    headline: "Terms and Conditions",
    checkboxLabel: "I agree to the terms and conditions",
    onChange: () => {},
  },
};

export const WithDescription: Story = {
  args: {
    elementId: "consent-2",
    inputId: "consent-input-2",
    headline: "Terms and Conditions",
    description: "Please read and accept the terms to continue",
    checkboxLabel: "I agree to the terms and conditions",
    onChange: () => {},
  },
};

export const WithConsent: Story = {
  args: {
    elementId: "consent-3",
    inputId: "consent-input-3",
    headline: "Terms and Conditions",
    checkboxLabel: "I agree to the terms and conditions",
    value: true,
    onChange: () => {},
  },
};

export const Required: Story = {
  args: {
    elementId: "consent-4",
    inputId: "consent-input-4",
    headline: "Terms and Conditions",
    checkboxLabel: "I agree to the terms and conditions",
    required: true,
    onChange: () => {},
  },
};

export const WithError: Story = {
  args: {
    elementId: "consent-5",
    inputId: "consent-input-5",
    headline: "Terms and Conditions",
    checkboxLabel: "I agree to the terms and conditions",
    required: true,
    errorMessage: "You must accept the terms to continue",
    onChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    elementId: "consent-6",
    inputId: "consent-input-6",
    headline: "Terms and Conditions",
    checkboxLabel: "I agree to the terms and conditions",
    value: true,
    disabled: true,
    onChange: () => {},
  },
};

export const RTL: Story = {
  args: {
    elementId: "consent-rtl",
    inputId: "consent-input-rtl",
    headline: "الشروط والأحكام",
    description: "يرجى قراءة الشروط والموافقة عليها",
    checkboxLabel: "أوافق على الشروط والأحكام",
    dir: "rtl",
    onChange: () => {},
  },
};

export const RTLWithConsent: Story = {
  args: {
    elementId: "consent-rtl-checked",
    inputId: "consent-input-rtl-checked",
    headline: "الشروط والأحكام",
    checkboxLabel: "أوافق على الشروط والأحكام",
    value: true,
    dir: "rtl",
    onChange: () => {},
  },
};

export const MultipleElements: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <Consent
        elementId="consent-1"
        inputId="consent-input-1"
        headline="Terms and Conditions"
        description="Please read and accept the terms"
        checkboxLabel="I agree to the terms and conditions"
        onChange={() => {}}
      />
      <Consent
        elementId="consent-2"
        inputId="consent-input-2"
        headline="Privacy Policy"
        description="Please review our privacy policy"
        checkboxLabel="I agree to the privacy policy"
        value
        onChange={() => {}}
      />
    </div>
  ),
};
