import { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./index";

interface CardStoryProps {
  title: string;
  description: string;
  content: string;
  footerContent: string;
  showFooter: boolean;
  className?: string;
  footerButton?: boolean;
}

const meta: Meta<CardStoryProps> = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha" },
    docs: {
      description: {
        component:
          "The **Card** component is a flexible container for content with consistent styling. It includes subcomponents like CardHeader, CardTitle, CardDescription, CardContent, and CardFooter for structured layouts.",
      },
    },
  },
  argTypes: {
    title: {
      control: "text",
      description: "Card title",
      table: { category: "Content" },
    },
    description: {
      control: "text",
      description: "Card description",
      table: { category: "Content" },
    },
    content: {
      control: "text",
      description: "Main content of the card",
      table: { category: "Content" },
    },
    footerContent: {
      control: "text",
      description: "Content for the card footer",
      table: { category: "Content" },
    },
    showFooter: {
      control: "boolean",
      description: "Toggle footer visibility",
      table: { category: "Behavior" },
    },
    footerButton: {
      control: "boolean",
      description: "Show a button in the footer",
      table: { category: "Behavior" },
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
      table: { category: "Appearance" },
    },
  },
  render: ({ title, description, content, footerContent, showFooter, footerButton, className }) => (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p>{content}</p>
      </CardContent>
      {showFooter && (
        <CardFooter>{footerButton ? <Button>{footerContent}</Button> : <p>{footerContent}</p>}</CardFooter>
      )}
    </Card>
  ),
};

export default meta;
type Story = StoryObj<CardStoryProps>;

export const Default: Story = {
  args: {
    title: "Default Card",
    description: "This is the default card description.",
    content: "This is the main content area of the card. You can put any React node here.",
    footerContent: "Footer content",
    showFooter: true,
    footerButton: false,
    className: "w-96",
  },
};

export const HeaderOnly: Story = {
  args: {
    ...Default.args,
    title: "Header Only",
    description: "This card only has a header.",
    content: "",
    showFooter: false,
  },
  parameters: {
    docs: {
      description: {
        story: "A card that only displays a header. Useful for short announcements or titles.",
      },
    },
  },
};

export const LongContent: Story = {
  args: {
    ...Default.args,
    title: "Card with Long Content",
    description: "This card demonstrates how longer content is handled.",
    content:
      "This is a card with a longer content section to demonstrate how the card component handles extensive text content. The card will expand to accommodate the content while maintaining proper spacing and readability. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    footerContent: "Read More",
    showFooter: true,
    footerButton: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Shows how the card handles longer content with proper spacing and layout.",
      },
    },
  },
};
