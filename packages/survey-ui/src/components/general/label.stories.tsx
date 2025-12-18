import type { Decorator, Meta, StoryContext, StoryObj } from "@storybook/react";
import React from "react";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Label, type LabelProps } from "./label";
import { Textarea } from "./textarea";

// Styling options for the StylingPlayground stories
interface HeadlineStylingOptions {
  headlineFontFamily: string;
  headlineFontWeight: string;
  headlineFontSize: string;
  headlineColor: string;
  headlineOpacity: string;
}

interface DescriptionStylingOptions {
  descriptionFontFamily: string;
  descriptionFontWeight: string;
  descriptionFontSize: string;
  descriptionColor: string;
  descriptionOpacity: string;
}

interface DefaultStylingOptions {
  labelFontFamily: string;
  labelFontWeight: string;
  labelFontSize: string;
  labelColor: string;
  labelOpacity: string;
}

type StoryProps = LabelProps &
  Partial<HeadlineStylingOptions & DescriptionStylingOptions & DefaultStylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/General/Label",
  component: Label,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A label component built with Radix UI primitives. Provides accessible labeling for form controls with proper association and styling.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "headline", "description"],
      description: "Visual style variant of the label",
      table: { category: "Component Props" },
    },
    htmlFor: {
      control: { type: "text" },
      description: "The id of the form control this label is associated with",
      table: { category: "Component Props" },
    },
    style: {
      control: "object",
      table: { category: "Component Props" },
    },
  },
  args: {
    children: "Label text",
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables for headline variant
const withHeadlineCSSVariables: Decorator<StoryProps> = (
  Story: React.ComponentType,
  context: StoryContext<StoryProps>
) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Storybook's Decorator type doesn't properly infer args type
  const args = context.args as StoryProps;
  const { headlineFontFamily, headlineFontWeight, headlineFontSize, headlineColor, headlineOpacity } = args;

  const cssVarStyle: React.CSSProperties & Record<string, string | undefined> = {
    "--fb-element-headline-font-family": headlineFontFamily ?? undefined,
    "--fb-element-headline-font-weight": headlineFontWeight ?? undefined,
    "--fb-element-headline-font-size": headlineFontSize ?? undefined,
    "--fb-element-headline-color": headlineColor ?? undefined,
    "--fb-element-headline-opacity": headlineOpacity ?? undefined,
  };

  return (
    <div style={cssVarStyle}>
      <Story />
    </div>
  );
};

// Decorator to apply CSS variables for description variant
const withDescriptionCSSVariables: Decorator<StoryProps> = (
  Story: React.ComponentType,
  context: StoryContext<StoryProps>
) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Storybook's Decorator type doesn't properly infer args type
  const args = context.args as StoryProps;
  const {
    descriptionFontFamily,
    descriptionFontWeight,
    descriptionFontSize,
    descriptionColor,
    descriptionOpacity,
  } = args;

  const cssVarStyle: React.CSSProperties & Record<string, string | undefined> = {
    "--fb-element-description-font-family": descriptionFontFamily ?? undefined,
    "--fb-element-description-font-weight": descriptionFontWeight ?? undefined,
    "--fb-element-description-font-size": descriptionFontSize ?? undefined,
    "--fb-element-description-color": descriptionColor ?? undefined,
    "--fb-element-description-opacity": descriptionOpacity ?? undefined,
  };

  return (
    <div style={cssVarStyle}>
      <Story />
    </div>
  );
};

const withCustomCSSVariables: Decorator<StoryProps> = (
  Story: React.ComponentType,
  context: StoryContext<StoryProps>
) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Storybook's Decorator type doesn't properly infer args type
  const args = context.args as StoryProps;
  const { labelFontFamily, labelFontWeight, labelFontSize, labelColor, labelOpacity } = args;

  const cssVarStyle: React.CSSProperties & Record<string, string | undefined> = {
    "--fb-label-font-family": labelFontFamily ?? undefined,
    "--fb-label-font-weight": labelFontWeight ?? undefined,
    "--fb-label-font-size": labelFontSize ?? undefined,
    "--fb-label-color": labelColor ?? undefined,
    "--fb-label-opacity": labelOpacity ?? undefined,
  };

  return (
    <div style={cssVarStyle}>
      <Story />
    </div>
  );
};

export const Default: Story = {
  args: {},
};

export const WithInput: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="username">Username</Label>
      <Input id="username" placeholder="Enter your username..." />
    </div>
  ),
};

export const WithCheckbox: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms">I agree to the terms and conditions</Label>
    </div>
  ),
};

export const WithTextarea: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="message">Message</Label>
      <Textarea id="message" placeholder="Enter your message..." />
    </div>
  ),
};

export const Required: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="email">
        Email address <span className="text-red-500">*</span>
      </Label>
      <Input id="email" type="email" placeholder="Enter your email..." required />
    </div>
  ),
};

export const Optional: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="website">
        Website <span className="text-muted-foreground">(optional)</span>
      </Label>
      <Input id="website" type="url" placeholder="https://..." />
    </div>
  ),
};

export const WithHelpText: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="password">Password</Label>
      <Input id="password" type="password" placeholder="Enter your password..." />
      <p className="text-muted-foreground text-sm">
        Must be at least 8 characters with a mix of letters and numbers
      </p>
    </div>
  ),
};

export const ErrorState: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="invalid-email">
        Email address <span className="text-red-500">*</span>
      </Label>
      <Input
        id="invalid-email"
        type="email"
        aria-invalid
        value="invalid-email"
        placeholder="Enter your email..."
      />
      <p className="text-destructive text-sm">Please enter a valid email address</p>
    </div>
  ),
};

export const FormSection: Story = {
  render: () => (
    <div className="w-[300px] space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-semibold">Personal Information</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="first-name">First name</Label>
            <Input id="first-name" placeholder="Enter your first name..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input id="last-name" placeholder="Enter your last name..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birth-date">Date of birth</Label>
            <Input id="birth-date" type="date" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold">Contact Information</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-email">
              Email address <span className="text-red-500">*</span>
            </Label>
            <Input id="contact-email" type="email" placeholder="Enter your email..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">
              Phone number <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id="phone" type="tel" placeholder="Enter your phone number..." />
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold">Preferences</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox id="newsletter" />
            <Label htmlFor="newsletter">Subscribe to newsletter</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="notifications" />
            <Label htmlFor="notifications">Enable email notifications</Label>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const LongLabel: Story = {
  render: () => (
    <div className="w-[350px] space-y-2">
      <Label htmlFor="long-label">
        This is a very long label that demonstrates how labels wrap when they contain a lot of text and need
        to span multiple lines
      </Label>
      <Input id="long-label" placeholder="Enter value..." />
    </div>
  ),
};

export const HeadlineVariant: Story = {
  args: {
    variant: "headline",
    children: "Headline Label",
    headlineFontFamily: "system-ui, sans-serif",
    headlineFontWeight: "600",
    headlineFontSize: "1.25rem",
    headlineColor: "#1e293b",
    headlineOpacity: "1",
  },
  argTypes: {
    headlineFontFamily: {
      control: "text",
      table: { category: "Headline Styling" },
    },
    headlineFontWeight: {
      control: "text",
      table: { category: "Headline Styling" },
    },
    headlineFontSize: {
      control: "text",
      table: { category: "Headline Styling" },
    },
    headlineColor: {
      control: "color",
      table: { category: "Headline Styling" },
    },
    headlineOpacity: {
      control: "text",
      table: { category: "Headline Styling" },
    },
  },
  decorators: [withHeadlineCSSVariables],
};

export const DescriptionVariant: Story = {
  args: {
    variant: "description",
    children: "Description Label",
    descriptionFontFamily: "system-ui, sans-serif",
    descriptionFontWeight: "400",
    descriptionFontSize: "0.875rem",
    descriptionColor: "#64748b",
    descriptionOpacity: "1",
  },
  argTypes: {
    descriptionFontFamily: {
      control: "text",
      table: { category: "Description Styling" },
    },
    descriptionFontWeight: {
      control: "text",
      table: { category: "Description Styling" },
    },
    descriptionFontSize: {
      control: "text",
      table: { category: "Description Styling" },
    },
    descriptionColor: {
      control: "color",
      table: { category: "Description Styling" },
    },
    descriptionOpacity: {
      control: "text",
      table: { category: "Description Styling" },
    },
  },
  decorators: [withDescriptionCSSVariables],
};

export const DefaultVariant: Story = {
  args: {
    variant: "default",
    children: "Default Label",
    labelFontFamily: "system-ui, sans-serif",
    labelFontWeight: "500",
    labelFontSize: "0.875rem",
    labelColor: "#1e293b",
    labelOpacity: "1",
  },
  argTypes: {
    labelFontFamily: {
      control: "text",
      table: { category: "Default Label Styling" },
    },
    labelFontWeight: {
      control: "text",
      table: { category: "Default Label Styling" },
    },
    labelFontSize: {
      control: "text",
      table: { category: "Default Label Styling" },
    },
    labelColor: {
      control: "color",
      table: { category: "Default Label Styling" },
    },
    labelOpacity: {
      control: "text",
      table: { category: "Default Label Styling" },
    },
  },
  decorators: [withCustomCSSVariables],
};
