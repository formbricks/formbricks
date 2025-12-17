import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "UI-package/General/Textarea",
  component: Textarea,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A flexible textarea component with error handling, custom styling, and RTL support. Built with accessibility in mind using proper ARIA attributes and automatic resizing.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    placeholder: {
      control: { type: "text" },
      description: "Placeholder text for the textarea",
    },
    disabled: {
      control: { type: "boolean" },
      description: "Whether the textarea is disabled",
    },
    required: {
      control: { type: "boolean" },
      description: "Whether the textarea is required",
    },
    rows: {
      control: { type: "number" },
      description: "Number of visible text lines",
    },
    errorMessage: {
      control: "text",
      description: "Error message to display below the textarea",
    },
    dir: {
      control: { type: "select" },
      options: ["ltr", "rtl"],
      description: "Text direction",
    },
    style: {
      control: { type: "object" },
      description: "Custom styling for the textarea",
    },
  },
  args: {
    placeholder: "Enter your text...",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithValue: Story = {
  args: {
    value:
      "This textarea has some predefined content that spans multiple lines.\n\nIt demonstrates how the component handles existing text.",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: "This textarea is disabled and cannot be edited.",
  },
};

export const WithRows: Story = {
  args: {
    rows: 5,
    placeholder: "This textarea has 5 visible rows...",
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="w-[300px] space-y-2">
      <Label htmlFor="message">Message</Label>
      <Textarea id="message" placeholder="Enter your message..." />
    </div>
  ),
};

export const LongContent: Story = {
  render: () => (
    <div className="w-[500px] space-y-2">
      <Label htmlFor="long-content">Terms and Conditions</Label>
      <Textarea
        id="long-content"
        rows={8}
        readOnly
        value={`Terms of Service

1. Acceptance of Terms
By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.

2. Use License
Permission is granted to temporarily download one copy of the materials on this website for personal, non-commercial transitory viewing only.

3. Disclaimer
The materials on this website are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.

4. Limitations
In no event shall our company or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on this website.`}
        className="font-mono text-sm"
      />
    </div>
  ),
};

export const WithError: Story = {
  args: {
    placeholder: "Enter your message",
    defaultValue: "Too short",
    errorMessage: "Message must be at least 10 characters long",
  },
};

export const RTL: Story = {
  args: {
    dir: "rtl",
    placeholder: "أدخل رسالتك هنا",
    defaultValue: "نص تجريبي طويل",
  },
};

export const CustomStyling: Story = {
  args: {
    placeholder: "Custom styled textarea",
    style: {
      height: "120px",
      borderRadius: "12px",
      padding: "16px",
      backgroundColor: "#f8f9fa",
      border: "2px solid #e9ecef",
    },
  },
};

export const WithErrorAndRTL: Story = {
  args: {
    dir: "rtl",
    placeholder: "أدخل رسالتك",
    errorMessage: "هذا الحقل مطلوب",
  },
};
