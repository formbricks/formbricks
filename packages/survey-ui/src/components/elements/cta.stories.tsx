import type { Meta, StoryObj } from "@storybook/react";
import {
  type BaseStylingOptions,
  type ButtonStylingOptions,
  buttonStylingArgTypes,
  commonArgTypes,
  createCSSVariablesDecorator,
  elementStylingArgTypes,
} from "../../lib/story-helpers";
import { CTA, type CTAProps } from "./cta";

type StoryProps = CTAProps & Partial<BaseStylingOptions & ButtonStylingOptions> & Record<string, unknown>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/CTA",
  component: CTA,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A Call-to-Action (CTA) element that displays a button. Can optionally open an external URL when clicked.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    ...commonArgTypes,
    buttonLabel: {
      control: "text",
      description: "Label text for the CTA button",
      table: { category: "Content" },
    },
    buttonUrl: {
      control: "text",
      description: "URL to open when button is clicked (if external)",
      table: { category: "Content" },
    },
    buttonExternal: {
      control: "boolean",
      description: "Whether the button opens an external URL",
      table: { category: "Content" },
    },
    buttonVariant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link", "custom"],
      description: "Variant for the button. Must be 'custom' for button styling controls to work.",
      table: { category: "Button Styling (Only applicable when buttonVariant is 'custom')" },
    },
    onClick: {
      action: () => {
        alert("clicked");
      },
      table: { category: "Events" },
    },
    ...elementStylingArgTypes,
    ...buttonStylingArgTypes,
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
};

export default meta;
type Story = StoryObj<StoryProps>;

export const Default: Story = {
  args: {
    elementId: "cta-1",
    inputId: "cta-input-1",
    headline: "Ready to get started?",
    buttonLabel: "Get Started",
    onClick: () => {
      alert("clicked");
    },
  },
};

export const WithDescription: Story = {
  args: {
    elementId: "cta-2",
    inputId: "cta-input-2",
    headline: "Ready to get started?",
    description: "Click the button below to begin your journey",
    buttonLabel: "Get Started",
    onClick: () => {
      alert("clicked");
    },
  },
};

export const ExternalButton: Story = {
  args: {
    elementId: "cta-3",
    inputId: "cta-input-3",
    headline: "Learn more about us",
    description: "Visit our website to learn more",
    buttonLabel: "Visit Website",
    buttonUrl: "https://example.com",
    buttonExternal: true,
    onClick: () => {
      alert("clicked");
    },
  },
};

export const Required: Story = {
  args: {
    elementId: "cta-4",
    inputId: "cta-input-4",
    headline: "Ready to get started?",
    buttonLabel: "Get Started",
    required: true,
    onClick: () => {
      alert("clicked");
    },
  },
};

export const WithError: Story = {
  args: {
    elementId: "cta-5",
    inputId: "cta-input-5",
    headline: "Ready to get started?",
    buttonLabel: "Get Started",
    required: true,
    errorMessage: "Please click the button to continue",
    onClick: () => {
      alert("clicked");
    },
  },
};

export const Disabled: Story = {
  args: {
    elementId: "cta-6",
    inputId: "cta-input-6",
    headline: "Ready to get started?",
    buttonLabel: "Get Started",
    disabled: true,
    onClick: () => {
      alert("clicked");
    },
  },
};

export const RTL: Story = {
  args: {
    elementId: "cta-rtl",
    inputId: "cta-input-rtl",
    headline: "هل أنت مستعد للبدء؟",
    description: "انقر على الزر أدناه للبدء",
    buttonLabel: "ابدأ الآن",
    dir: "rtl",
    onClick: () => {
      alert("clicked");
    },
  },
};

export const MultipleElements: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <CTA
        elementId="cta-1"
        inputId="cta-input-1"
        headline="Ready to get started?"
        description="Click the button below to begin"
        buttonLabel="Get Started"
        onClick={() => {
          alert("clicked");
        }}
      />
      <CTA
        elementId="cta-2"
        inputId="cta-input-2"
        headline="Learn more about us"
        description="Visit our website"
        buttonLabel="Visit Website"
        buttonUrl="https://example.com"
        buttonExternal
        onClick={() => {
          alert("clicked");
        }}
      />
    </div>
  ),
};
