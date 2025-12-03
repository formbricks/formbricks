import type { Meta, StoryContext, StoryObj } from "@storybook/react";
import React from "react";
import { Input, type InputProps } from "./input";

// Styling options for the StylingPlayground story
interface StylingOptions {
  inputWidth: string;
  inputHeight: string;
  inputBgColor: string;
  inputBorderColor: string;
  inputBorderRadius: string;
  inputFontFamily: string;
  inputFontSize: string;
  inputFontWeight: string;
  inputColor: string;
  inputPlaceholderColor: string;
  inputPaddingX: string;
  inputPaddingY: string;
  inputShadow: string;
}

type StoryProps = InputProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: { type: "select" },
      options: ["text", "email", "password", "number", "tel", "url", "search", "file"],
      table: { category: "Component Props" },
    },
    placeholder: {
      control: "text",
      table: { category: "Component Props" },
    },
    disabled: {
      control: "boolean",
      table: { category: "Component Props" },
    },
    errorMessage: {
      control: "text",
      table: { category: "Component Props" },
    },
    dir: {
      control: { type: "select" },
      options: ["ltr", "rtl"],
      table: { category: "Component Props" },
    },
    style: {
      control: "object",
      table: { category: "Component Props" },
    },
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args
function withCSSVariables(Story: React.ComponentType, context: StoryContext<StoryProps>) {
  const {
    inputWidth,
    inputHeight,
    inputBgColor,
    inputBorderColor,
    inputBorderRadius,
    inputFontFamily,
    inputFontSize,
    inputFontWeight,
    inputColor,
    inputPlaceholderColor,
    inputPaddingX,
    inputPaddingY,
    inputShadow,
  } = context.args;

  const cssVarStyle = {
    "--fb-input-width": inputWidth,
    "--fb-input-height": inputHeight,
    "--fb-input-bg-color": inputBgColor,
    "--fb-input-border-color": inputBorderColor,
    "--fb-input-border-radius": inputBorderRadius,
    "--fb-input-font-family": inputFontFamily,
    "--fb-input-font-size": inputFontSize,
    "--fb-input-font-weight": inputFontWeight,
    "--fb-input-color": inputColor,
    "--fb-input-placeholder-color": inputPlaceholderColor,
    "--fb-input-padding-x": inputPaddingX,
    "--fb-input-padding-y": inputPaddingY,
    "--fb-input-shadow": inputShadow,
  } as React.CSSProperties;

  return (
    <div style={cssVarStyle}>
      <Story />
    </div>
  );
}

export const StylingPlayground: Story = {
  args: {
    placeholder: "Enter text...",
    // Default styling values
    inputWidth: "400px",
    inputHeight: "2.5rem",
    inputBgColor: "#ffffff",
    inputBorderColor: "#e2e8f0",
    inputBorderRadius: "0.5rem",
    inputFontFamily: "system-ui, sans-serif",
    inputFontSize: "0.875rem",
    inputFontWeight: "400",
    inputColor: "#1e293b",
    inputPlaceholderColor: "#94a3b8",
    inputPaddingX: "0.75rem",
    inputPaddingY: "0.5rem",
    inputShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  },
  argTypes: {
    // Input Styling (CSS Variables) - Only for this story
    inputWidth: {
      control: "text",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "100%" },
      },
    },
    inputHeight: {
      control: "text",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "2.25rem" },
      },
    },
    inputBgColor: {
      control: "color",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "transparent" },
      },
    },
    inputBorderColor: {
      control: "color",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "var(--input)" },
      },
    },
    inputBorderRadius: {
      control: "text",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "0.5rem" },
      },
    },
    inputFontFamily: {
      control: "text",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "inherit" },
      },
    },
    inputFontSize: {
      control: "text",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "0.875rem" },
      },
    },
    inputFontWeight: {
      control: "text",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "400" },
      },
    },
    inputColor: {
      control: "color",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "var(--foreground)" },
      },
    },
    inputPlaceholderColor: {
      control: "color",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "var(--muted-foreground)" },
      },
    },
    inputPaddingX: {
      control: "text",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "0.75rem" },
      },
    },
    inputPaddingY: {
      control: "text",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "0.25rem" },
      },
    },
    inputShadow: {
      control: "text",
      table: {
        category: "Input Styling",
        defaultValue: { summary: "0 1px 2px 0 rgb(0 0 0 / 0.05)" },
      },
    },
  },
  decorators: [withCSSVariables],
};

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
