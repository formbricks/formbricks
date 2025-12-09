import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React from "react";
import { CTA, type CTAProps } from "./cta";

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
  // Button styling
  buttonHeight: string;
  buttonWidth: string;
  buttonFontSize: string;
  buttonBorderRadius: string;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonPaddingX: string;
  buttonPaddingY: string;
}

type StoryProps = CTAProps & Partial<StylingOptions>;

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
    buttonHeight,
    buttonWidth,
    buttonFontSize,
    buttonBorderRadius,
    buttonBgColor,
    buttonTextColor,
    buttonPaddingX,
    buttonPaddingY,
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
    "--fb-button-height": buttonHeight,
    "--fb-button-width": buttonWidth,
    "--fb-button-font-size": buttonFontSize,
    "--fb-button-border-radius": buttonBorderRadius,
    "--fb-button-bg-color": buttonBgColor,
    "--fb-button-text-color": buttonTextColor,
    "--fb-button-padding-x": buttonPaddingX,
    "--fb-button-padding-y": buttonPaddingY,
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

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
      description: "Whether the button is disabled",
      table: { category: "State" },
    },
    onClick: {
      action: () => {
        alert("clicked");
      },
      table: { category: "Events" },
    },
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
    buttonHeight: {
      control: "text",
      description: "Font family for the button",
      table: { category: "Button Styling (Only applicable when buttonVariant is 'custom')" },
    },
    buttonFontSize: {
      control: "text",
      description: "Font size for the button",
      table: { category: "Button Styling (Only applicable when buttonVariant is 'custom')" },
    },
    buttonBorderRadius: {
      control: "text",
      description: "Border radius for the button",
      table: { category: "Button Styling (Only applicable when buttonVariant is 'custom')" },
    },
    buttonBgColor: {
      control: "color",
      description: "Background color for the button",
      table: { category: "Button Styling (Only applicable when buttonVariant is 'custom')" },
    },
    buttonTextColor: {
      control: "color",
      description: "Text color for the button",
      table: { category: "Button Styling (Only applicable when buttonVariant is 'custom')" },
    },
    buttonPaddingX: {
      control: "text",
      description: "Padding x for the button",
      table: { category: "Button Styling (Only applicable when buttonVariant is 'custom')" },
    },
    buttonPaddingY: {
      control: "text",
      description: "Padding y for the button",
      table: { category: "Button Styling (Only applicable when buttonVariant is 'custom')" },
    },
    buttonVariant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link", "custom"],
      description: "Variant for the button. Must be 'custom' for button styling controls to work.",
      table: { category: "Button Styling (Only applicable when buttonVariant is 'custom')" },
    },
  },
  decorators: [withCSSVariables],
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
