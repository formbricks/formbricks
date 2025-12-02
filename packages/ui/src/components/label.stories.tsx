import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";

const meta: Meta<typeof Label> = {
  title: "UI-package/Label",
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
    htmlFor: {
      control: { type: "text" },
      description: "The id of the form control this label is associated with",
    },
  },
  args: {
    children: "Label text",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

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
