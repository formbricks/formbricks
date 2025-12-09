import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { FileUpload, type FileUploadProps, type UploadedFile } from "./file-upload";

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
  // Input styling
  inputWidth: string;
  inputHeight: string;
  inputBgColor: string;
  inputBorderColor: string;
  inputBorderRadius: string;
  inputFontSize: string;
  inputColor: string;
  inputPlaceholderColor: string;
  inputPaddingX: string;
  inputPaddingY: string;
}

type StoryProps = FileUploadProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/FileUpload",
  component: FileUpload,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete file upload question element that combines headline, description, and a file upload area with drag-and-drop support. Supports file type restrictions, size limits, multiple files, validation, and RTL text direction.",
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
    value: {
      control: "object",
      description: "Array of uploaded files",
      table: { category: "State" },
    },
    allowMultiple: {
      control: "boolean",
      description: "Whether multiple files are allowed",
      table: { category: "Behavior" },
    },
    maxSizeInMB: {
      control: "number",
      description: "Maximum file size in MB",
      table: { category: "Validation" },
    },
    allowedFileExtensions: {
      control: "object",
      description: "Allowed file extensions (e.g., ['.pdf', '.jpg'])",
      table: { category: "Validation" },
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
      description: "Whether the file input is disabled",
      table: { category: "State" },
    },
    onChange: {
      action: "changed",
      table: { category: "Events" },
    },
  },
  render: function Render(args: StoryProps) {
    const [value, setValue] = useState(args.value);

    useEffect(() => {
      setValue(args.value);
    }, [args.value]);

    return (
      <FileUpload
        {...args}
        value={value}
        onChange={(v) => {
          setValue(v);
          args.onChange?.(v);
        }}
      />
    );
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
  inputFontSize: {
    control: "text",
    table: { category: "Input Styling" },
  },
  inputColor: {
    control: "color",
    table: { category: "Input Styling" },
  },
  inputPlaceholderColor: {
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
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args
const withCSSVariables: Decorator<StoryProps> = (Story: any, context: any) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Storybook's Decorator type doesn't properly infer args type
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
    inputBorderColor,
    inputColor,
    inputBgColor,
    inputBorderRadius,
    inputFontSize,
    inputPaddingX,
    inputPaddingY,
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
    "--fb-input-border-color": inputBorderColor,
    "--fb-input-color": inputColor,
    "--fb-input-bg-color": inputBgColor,
    "--fb-input-border-radius": inputBorderRadius,
    "--fb-input-font-size": inputFontSize,
    "--fb-input-padding-x": inputPaddingX,
    "--fb-input-padding-y": inputPaddingY,
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

export const StylingPlayground: Story = {
  args: {
    headline: "Upload your file",
    description: "Please select a file to upload",
  },
  argTypes: {
    // Question styling
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
  },
  decorators: [withCSSVariables],
};

export const Default: Story = {
  args: {
    headline: "Upload your file",
  },
};

export const WithDescription: Story = {
  args: {
    headline: "Upload your resume",
    description: "Please upload your resume in PDF format",
  },
};

export const SingleFile: Story = {
  args: {
    headline: "Upload a single file",
    description: "Select one file to upload",
    allowMultiple: false,
  },
};

export const MultipleFiles: Story = {
  args: {
    headline: "Upload multiple files",
    description: "You can upload multiple files at once",
    allowMultiple: true,
  },
};

export const WithFileTypeRestrictions: Story = {
  args: {
    headline: "Upload an image",
    description: "Please upload an image file",
    allowedFileExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  },
};

export const WithSizeLimit: Story = {
  args: {
    headline: "Upload a document",
    description: "Maximum file size: 5MB",
    maxSizeInMB: 5,
  },
};

export const WithRestrictions: Story = {
  args: {
    headline: "Upload a PDF document",
    description: "PDF files only, maximum 10MB",
    allowedFileExtensions: [".pdf"],
    maxSizeInMB: 10,
  },
};

export const Required: Story = {
  args: {
    headline: "Upload required file",
    description: "Please upload a file",
    required: true,
  },
};

export const WithUploadedFiles: Story = {
  args: {
    headline: "Upload your files",
    description: "Files you've uploaded",
    allowMultiple: true,
    value: [
      {
        name: "document.pdf",
        url: "data:application/pdf;base64,...",
        size: 1024 * 500, // 500 KB
      },
      {
        name: "image.jpg",
        url: "data:image/jpeg;base64,...",
        size: 1024 * 1024 * 2, // 2 MB
      },
    ] as UploadedFile[],
  },
};

export const WithError: Story = {
  args: {
    headline: "Upload your file",
    description: "Please upload a file",
    errorMessage: "Please upload at least one file",
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    headline: "This upload is disabled",
    description: "You cannot upload files",
    value: [
      {
        name: "existing-file.pdf",
        url: "data:application/pdf;base64,...",
        size: 1024 * 300,
      },
    ] as UploadedFile[],
    disabled: true,
  },
};

export const RTL: Story = {
  args: {
    headline: "قم بتحميل ملفك",
    description: "يرجى اختيار ملف للتحميل",
  },
};

export const RTLWithFiles: Story = {
  args: {
    headline: "قم بتحميل ملفاتك",
    description: "الملفات التي قمت بتحميلها",
    allowMultiple: true,
    value: [
      {
        name: "ملف.pdf",
        url: "data:application/pdf;base64,...",
        size: 1024 * 500,
      },
    ] as UploadedFile[],
  },
};

export const MultipleQuestions: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <FileUpload
        elementId="file-1"
        inputId="file-1-input"
        headline="Upload your resume"
        description="PDF format only"
        allowedFileExtensions={[".pdf"]}
        onChange={() => {}}
      />
      <FileUpload
        elementId="file-2"
        inputId="file-2-input"
        headline="Upload multiple images"
        description="You can upload multiple images"
        allowMultiple
        allowedFileExtensions={[".jpg", ".png", ".gif"]}
        maxSizeInMB={5}
        onChange={() => {}}
      />
    </div>
  ),
};
