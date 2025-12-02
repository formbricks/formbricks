import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI-package/Input",
  component: Input,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A flexible input component with error handling, custom styling, and RTL support. Built with accessibility in mind using proper ARIA attributes.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: { type: "select" },
      options: ["text", "email", "password", "number", "tel", "url", "search", "file"],
      description: "HTML input type",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text",
    },
    disabled: {
      control: "boolean",
      description: "Whether the input is disabled",
    },
    errorMessage: {
      control: "text",
      description: "Error message to display below the input",
    },
    dir: {
      control: { type: "select" },
      options: ["ltr", "rtl"],
      description: "Text direction",
    },
    style: {
      control: "object",
      description: "Custom style to apply to the input",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: "Sample text",
    placeholder: "Enter text...",
  },
};

export const Email: Story = {
  args: {
    type: "email",
    placeholder: "email@example.com",
  },
};

export const Password: Story = {
  args: {
    type: "password",
    placeholder: "Enter password",
  },
};

export const NumberInput: Story = {
  args: {
    type: "number",
    placeholder: "0",
  },
};

export const WithError: Story = {
  args: {
    placeholder: "Enter your email",
    defaultValue: "invalid-email",
    errorMessage: "Please enter a valid email address",
  },
};

export const Disabled: Story = {
  args: {
    placeholder: "Disabled input",
    disabled: true,
  },
};

export const DisabledWithValue: Story = {
  args: {
    defaultValue: "Cannot edit this",
    disabled: true,
  },
};

export const FileUpload: Story = {
  args: {
    type: "file",
  },
};

export const FileUploadWithRTL: Story = {
  args: {
    type: "file",
    dir: "rtl",
  },
};

export const FileUploadWithError: Story = {
  args: {
    type: "file",
    errorMessage: "Please upload a valid file",
  },
};

export const FileUploadWithErrorAndRTL: Story = {
  args: {
    type: "file",
    errorMessage: "Please upload a valid file",
    dir: "rtl",
  },
};

export const RTL: Story = {
  args: {
    dir: "rtl",
    placeholder: "أدخل النص هنا",
    defaultValue: "نص تجريبي",
  },
};

export const CustomStyling: Story = {
  args: {
    placeholder: "Custom styled input",
    style: {
      height: "48px",
      borderRadius: "12px",
      padding: "16px",
      backgroundColor: "#f8f9fa",
    },
  },
};

export const FullWidth: Story = {
  args: {
    placeholder: "Full width input",
    className: "w-96",
  },
};

export const WithErrorAndRTL: Story = {
  args: {
    dir: "rtl",
    placeholder: "أدخل بريدك الإلكتروني",
    errorMessage: "هذا الحقل مطلوب",
  },
};
