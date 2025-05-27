import type { Meta, StoryObj } from "@storybook/react";
import { AlertCircle } from "lucide-react";
import { Button } from "../button";
import {
  MyDialog,
  MyDialogBody,
  MyDialogContent,
  MyDialogDescription,
  MyDialogFooter,
  MyDialogHeader,
  MyDialogTitle,
  MyDialogTrigger,
} from "./index";

interface ModalStoryProps {
  triggerText: string;
  showHeader: boolean;
  showIcon: boolean;
  title: string;
  description: string;

  bodyContent: React.ReactNode;

  showFooter: boolean;
  FooterButtonConfiguration: "1" | "2" | "3";
  primaryButtonText: string;
  secondaryButtonText: string;
  tertiaryButtonText: string;
  hideCloseButton?: boolean;
  isWide?: boolean;
}
const DefaultBodyContent = (elementCount: number) => {
  return (
    <div>
      {Array(elementCount)
        .fill(0)
        .map((_, i) => (
          <p key={i}>Scrollable content line {i + 1}</p>
        ))}
    </div>
  );
};

const ModalStory = ({
  triggerText,
  showHeader,
  showIcon,
  title,
  description,
  bodyContent,
  showFooter,
  primaryButtonText,
  secondaryButtonText,
  tertiaryButtonText,
  hideCloseButton,
  isWide,
}: ModalStoryProps) => (
  <MyDialog>
    <MyDialogTrigger asChild>
      <Button variant="outline">{triggerText}</Button>
    </MyDialogTrigger>
    <MyDialogContent
      hideCloseButton={hideCloseButton}
      className={isWide ? "sm:w-[1200px] sm:max-w-[90vw]" : undefined}>
      {showHeader && (
        <MyDialogHeader>
          {showIcon && <AlertCircle />}
          <MyDialogTitle>{title}</MyDialogTitle>
          <MyDialogDescription>{description}</MyDialogDescription>
        </MyDialogHeader>
      )}
      {bodyContent && <MyDialogBody>{bodyContent}</MyDialogBody>}
      {showFooter && (
        <MyDialogFooter className="md:justify-between">
          <Button className="justify-self-start" variant="ghost">
            {tertiaryButtonText}
          </Button>
          <div className="flex md:space-x-1.5">
            <Button variant="secondary">{secondaryButtonText}</Button>
            <Button>{primaryButtonText}</Button>
          </div>
        </MyDialogFooter>
      )}
    </MyDialogContent>
  </MyDialog>
);

const meta = {
  title: "UI/Unified Modal",
  component: ModalStory,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    showIcon: {
      control: "boolean",
      description: "Whether to show an icon in the header",
      category: "Appearance",
    },
    triggerText: {
      control: "text",
      description: "Text for the trigger button",
    },
    title: {
      control: "text",
      description: "Modal title text",
    },
    description: {
      control: "text",
      description: "Modal description text",
    },
    FooterButtonConfiguration: {
      control: "select",
      description: "Configuration for the footer buttons",
      options: ["1", "2", "3"],
    },
    hideCloseButton: {
      control: "boolean",
      description: "Whether to hide the close button (X)",
      category: "Behavior",
    },
    isWide: {
      control: "boolean",
      description: "Whether to make the modal wider",
      category: "Appearance",
    },
  },
} satisfies Meta<typeof ModalStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    triggerText: "Open Modal",
    showHeader: true,
    showIcon: true,
    title: "Modal Title",
    description: "This is a description of what this modal is for.",
    bodyContent: DefaultBodyContent(5),
    showFooter: true,
    FooterButtonConfiguration: "3",
    primaryButtonText: "Confirm",
    secondaryButtonText: "Cancel",
    tertiaryButtonText: "Learn more",
  },
};

export const OnlyBody: Story = {
  args: {
    triggerText: "Open Modal",
    showHeader: false,
    showIcon: false,
    title: "",
    description: "",
    bodyContent: DefaultBodyContent(50),
    showFooter: false,
    FooterButtonConfiguration: "1",
    primaryButtonText: "",
    secondaryButtonText: "",
    tertiaryButtonText: "",
  },
};

export const NoFooter: Story = {
  args: {
    triggerText: "Open Modal - No Footer",
    showHeader: true,
    showIcon: true,
    title: "Modal Without Footer",
    description: "This modal has a header and body but no footer buttons.",
    bodyContent: DefaultBodyContent,
    showFooter: false,
    FooterButtonConfiguration: "1",
    primaryButtonText: "",
    secondaryButtonText: "",
    tertiaryButtonText: "",
  },
};

export const NoHeader: Story = {
  args: {
    triggerText: "Open Modal - No Header",
    showHeader: false,
    showIcon: false,
    title: "",
    description: "",
    bodyContent: DefaultBodyContent,
    showFooter: true,
    FooterButtonConfiguration: "2",
    primaryButtonText: "Confirm",
    secondaryButtonText: "Cancel",
    tertiaryButtonText: "",
  },
};

export const RestrictClose: Story = {
  args: {
    triggerText: "Open Modal - Restrict Close",
    showHeader: true,
    showIcon: true,
    title: "Modal with Restricted Close",
    description: "This modal hides the close button to prevent accidental closing.",
    bodyContent: DefaultBodyContent,
    showFooter: true,
    FooterButtonConfiguration: "2",
    primaryButtonText: "Save",
    secondaryButtonText: "Cancel",
    tertiaryButtonText: "",
    hideCloseButton: true,
  },
};

export const WideModal: Story = {
  args: {
    triggerText: "Open Wide Modal",
    showHeader: true,
    showIcon: true,
    title: "Wide Modal",
    description: "This modal is wider than the default size for displaying more content.",
    bodyContent: (
      <div>
        <p>This is a wide modal that can accommodate more content horizontally.</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded bg-gray-100 p-4">
            <h3 className="font-semibold">Left Column</h3>
            <p>Content in the left column</p>
          </div>
          <div className="rounded bg-gray-100 p-4">
            <h3 className="font-semibold">Right Column</h3>
            <p>Content in the right column</p>
          </div>
        </div>
      </div>
    ),
    showFooter: true,
    FooterButtonConfiguration: "3",
    primaryButtonText: "Save",
    secondaryButtonText: "Cancel",
    tertiaryButtonText: "Reset",
    isWide: true,
  },
};
