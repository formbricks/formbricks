import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import {
  type BaseStylingOptions,
  type InputLayoutStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  elementStylingArgTypes,
  inputStylingArgTypes,
  pickArgTypes,
} from "../../lib/story-helpers";
import { FileUpload, type FileUploadProps, type UploadedFile } from "./file-upload";

type StoryProps = FileUploadProps &
  Partial<BaseStylingOptions & InputLayoutStylingOptions> &
  Record<string, unknown>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/FileUpload",
  component: FileUpload,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete file upload element that combines headline, description, and a file upload area with drag-and-drop support. Supports file type restrictions, size limits, multiple files, validation, and RTL text direction.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [createCSSVariablesDecorator<StoryProps>()],
  argTypes: {
    ...commonArgTypes,
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
    ...elementStylingArgTypes,
    ...pickArgTypes(inputStylingArgTypes, [
      "inputBgColor",
      "inputBorderColor",
      "inputColor",
      "inputFontSize",
      "inputFontWeight",
      "inputWidth",
      "inputHeight",
      "inputBorderRadius",
      "inputPaddingX",
      "inputPaddingY",
    ]),
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
};

export default meta;
type Story = StoryObj<StoryProps>;

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
    dir: "rtl",
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
    dir: "rtl",
  },
};

export const MultipleElements: Story = {
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
        onChange={() => {}}
      />
    </div>
  ),
};
