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

// Story options separate from component props
interface StoryOptions {
  triggerText: string;
  showHeader: boolean;
  showIcon: boolean;
  title: string;
  description: string;
  bodyContent?: React.ReactNode;
  showFooter: boolean;
  footerButtonConfiguration: "1" | "2" | "3";
  primaryButtonText: string;
  secondaryButtonText: string;
  tertiaryButtonText: string;
  bodyElementCount: number;
}

type StoryProps = React.ComponentProps<typeof MyDialogContent> & StoryOptions;

const DefaultBodyContent = (elementCount: number): React.ReactNode => {
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

const meta: Meta<StoryProps> = {
  title: "UI/Unified Modal",
  component: MyDialogContent,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: {
      sort: "requiredFirst",
      exclude: [],
    },
  },
  argTypes: {
    // Component Props - Behavior Category
    hideCloseButton: {
      control: "boolean",
      description: "Whether to hide the close button (X)",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 1,
    },
    disableCloseOnOutsideClick: {
      control: "boolean",
      description: "Whether to disable closing when clicking outside",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 2,
    },
    width: {
      control: "select",
      options: ["default", "wide"],
      description: "Width of the modal",
      table: {
        category: "Appearance",
        type: { summary: "string" },
        defaultValue: { summary: "default" },
      },
      order: 1,
    },

    // Story Options - Appearance Category
    showIcon: {
      control: "boolean",
      description: "Whether to show an icon in the header",
      table: {
        category: "Appearance",
        type: { summary: "boolean" },
      },
      order: 2,
    },
    showHeader: {
      control: "boolean",
      description: "Whether to show the header section",
      table: {
        category: "Appearance",
        type: { summary: "boolean" },
      },
      order: 3,
    },
    showFooter: {
      control: "boolean",
      description: "Whether to show the footer section",
      table: {
        category: "Appearance",
        type: { summary: "boolean" },
      },
      order: 4,
    },
    footerButtonConfiguration: {
      control: "select",
      options: ["1", "2", "3"],
      description: "Number of buttons to show in footer",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
      order: 5,
    },

    // Story Options - Content Category
    triggerText: {
      control: "text",
      description: "Text for the trigger button",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 1,
    },
    title: {
      control: "text",
      description: "Modal title text",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 2,
    },
    description: {
      control: "text",
      description: "Modal description text",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 3,
    },
    primaryButtonText: {
      control: "text",
      description: "Text for the primary button",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 4,
    },
    secondaryButtonText: {
      control: "text",
      description: "Text for the secondary button",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 5,
    },
    tertiaryButtonText: {
      control: "text",
      description: "Text for the tertiary button",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 6,
    },
    bodyElementCount: {
      control: { type: "number", min: 1, max: 100, step: 1 },
      description: "Number of elements in the body content",
      table: {
        category: "Content",
        type: { summary: "number" },
      },
      order: 7,
    },
  },
};

export default meta;

type Story = StoryObj<typeof MyDialogContent> & { args: StoryOptions };

// Create a common render function to reduce duplication
const renderModal = (args: StoryProps) => {
  // Extract component props
  const {
    hideCloseButton = false,
    disableCloseOnOutsideClick = false,
    width = "default",
    className = "",
  } = args;

  // Extract story content options
  const {
    triggerText = "Open Modal",
    showHeader = true,
    showIcon = false,
    title = "Modal Title",
    description = "Modal description",
    showFooter = true,
    footerButtonConfiguration = "3",
    primaryButtonText = "Confirm",
    secondaryButtonText = "Cancel",
    tertiaryButtonText = "Learn more",
    bodyElementCount = 5,
  } = args as StoryOptions;

  const bodyContent = DefaultBodyContent(bodyElementCount);

  return (
    <MyDialog>
      <MyDialogTrigger asChild>
        <Button variant="outline">{triggerText}</Button>
      </MyDialogTrigger>
      <MyDialogContent
        hideCloseButton={hideCloseButton}
        disableCloseOnOutsideClick={disableCloseOnOutsideClick}
        width={width}
        className={className}>
        {showHeader && (
          <MyDialogHeader>
            {showIcon && <AlertCircle />}
            <MyDialogTitle>{title}</MyDialogTitle>
            <MyDialogDescription>{description}</MyDialogDescription>
          </MyDialogHeader>
        )}
        <MyDialogBody>{bodyContent}</MyDialogBody>
        {showFooter && (
          <MyDialogFooter className="md:justify-between">
            {footerButtonConfiguration === "3" && (
              <Button className="justify-self-start" variant="ghost">
                {tertiaryButtonText}
              </Button>
            )}
            <div className="flex md:space-x-1.5">
              {(footerButtonConfiguration === "2" || footerButtonConfiguration === "3") && (
                <Button variant="secondary">{secondaryButtonText}</Button>
              )}
              <Button>{primaryButtonText}</Button>
            </div>
          </MyDialogFooter>
        )}
      </MyDialogContent>
    </MyDialog>
  );
};

export const Default: Story = {
  render: renderModal,
  args: {
    triggerText: "Open Modal",
    showHeader: true,
    showIcon: true,
    title: "Modal Title",
    description: "This is a description of what this modal is for.",
    showFooter: true,
    footerButtonConfiguration: "3",
    primaryButtonText: "Confirm",
    secondaryButtonText: "Cancel",
    tertiaryButtonText: "Learn more",
    bodyElementCount: 5,
    hideCloseButton: false,
    disableCloseOnOutsideClick: false,
    width: "default",
  },
};

export const OnlyBody: Story = {
  render: renderModal,
  args: {
    triggerText: "Open Modal - Body Only",
    showHeader: false,
    showIcon: false,
    title: "",
    description: "",
    showFooter: false,
    footerButtonConfiguration: "1",
    primaryButtonText: "",
    secondaryButtonText: "",
    tertiaryButtonText: "",
    bodyElementCount: 50,
    hideCloseButton: false,
    disableCloseOnOutsideClick: false,
    width: "default",
  },
  parameters: {
    docs: {
      description: {
        story: "A minimal modal with only body content, useful for simple content display.",
      },
    },
  },
};

export const NoFooter: Story = {
  render: renderModal,
  args: {
    triggerText: "Open Modal - No Footer",
    showHeader: true,
    showIcon: true,
    title: "Modal Without Footer",
    description: "This modal has a header and body but no footer buttons.",
    showFooter: false,
    footerButtonConfiguration: "1",
    primaryButtonText: "",
    secondaryButtonText: "",
    tertiaryButtonText: "",
    bodyElementCount: 10,
    hideCloseButton: false,
    disableCloseOnOutsideClick: false,
    width: "default",
  },
  parameters: {
    docs: {
      description: {
        story: "Modal with header and body content but no footer actions.",
      },
    },
  },
};

export const NoHeader: Story = {
  render: renderModal,
  args: {
    triggerText: "Open Modal - No Header",
    showHeader: false,
    showIcon: false,
    title: "",
    description: "",
    showFooter: true,
    footerButtonConfiguration: "2",
    primaryButtonText: "Confirm",
    secondaryButtonText: "Cancel",
    tertiaryButtonText: "",
    bodyElementCount: 8,
    hideCloseButton: false,
    disableCloseOnOutsideClick: false,
    width: "default",
  },
  parameters: {
    docs: {
      description: {
        story: "Modal without header, useful when you want to focus on content and actions.",
      },
    },
  },
};

export const RestrictClose: Story = {
  render: renderModal,
  args: {
    triggerText: "Open Modal - Restrict Close",
    showHeader: true,
    showIcon: true,
    title: "Modal with Restricted Close",
    description: "This modal hides the close button and prevents closing on outside click.",
    showFooter: true,
    footerButtonConfiguration: "2",
    primaryButtonText: "Save",
    secondaryButtonText: "Cancel",
    tertiaryButtonText: "",
    bodyElementCount: 5,
    hideCloseButton: true,
    disableCloseOnOutsideClick: true,
    width: "default",
  },
  parameters: {
    docs: {
      description: {
        story: "Use when you need to force user interaction with the modal content before closing.",
      },
    },
  },
};

export const WideModal: Story = {
  render: (args: StoryProps) => {
    const {
      hideCloseButton = false,
      disableCloseOnOutsideClick = false,
      width = "wide",
      className = "",
    } = args;

    const {
      triggerText = "Open Wide Modal",
      showHeader = true,
      showIcon = true,
      title = "Wide Modal",
      description = "This modal is wider than the default size for displaying more content.",
      showFooter = true,
      footerButtonConfiguration = "3",
      primaryButtonText = "Save",
      secondaryButtonText = "Cancel",
      tertiaryButtonText = "Reset",
    } = args as StoryOptions;

    const wideBodyContent = (
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
    );

    return (
      <MyDialog>
        <MyDialogTrigger asChild>
          <Button variant="outline">{triggerText}</Button>
        </MyDialogTrigger>
        <MyDialogContent
          hideCloseButton={hideCloseButton}
          disableCloseOnOutsideClick={disableCloseOnOutsideClick}
          width={width}
          className={className}>
          {showHeader && (
            <MyDialogHeader>
              {showIcon && <AlertCircle />}
              <MyDialogTitle>{title}</MyDialogTitle>
              <MyDialogDescription>{description}</MyDialogDescription>
            </MyDialogHeader>
          )}
          <MyDialogBody>{wideBodyContent}</MyDialogBody>
          {showFooter && (
            <MyDialogFooter className="md:justify-between">
              {footerButtonConfiguration === "3" && (
                <Button className="justify-self-start" variant="ghost">
                  {tertiaryButtonText}
                </Button>
              )}
              <div className="flex md:space-x-1.5">
                {(footerButtonConfiguration === "2" || footerButtonConfiguration === "3") && (
                  <Button variant="secondary">{secondaryButtonText}</Button>
                )}
                <Button>{primaryButtonText}</Button>
              </div>
            </MyDialogFooter>
          )}
        </MyDialogContent>
      </MyDialog>
    );
  },
  args: {
    triggerText: "Open Wide Modal",
    showHeader: true,
    showIcon: true,
    title: "Wide Modal",
    description: "This modal is wider than the default size for displaying more content.",
    showFooter: true,
    footerButtonConfiguration: "3",
    primaryButtonText: "Save",
    secondaryButtonText: "Cancel",
    tertiaryButtonText: "Reset",
    bodyElementCount: 5,
    hideCloseButton: false,
    disableCloseOnOutsideClick: false,
    width: "wide",
  },
  parameters: {
    docs: {
      description: {
        story: "Use the wide variant when you need more horizontal space for complex layouts.",
      },
    },
  },
};
