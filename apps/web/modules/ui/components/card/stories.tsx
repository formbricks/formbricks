import { Meta, StoryObj } from "@storybook/react-vite";
import { BellRing, CreditCard, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./index";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "The **Card** component is a flexible container for content with consistent styling. It includes subcomponents like CardHeader, CardTitle, CardDescription, CardContent, and CardFooter for structured layouts.",
      },
    },
  },
  argTypes: {
    className: {
      control: "text",
      description: "Additional CSS classes",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
      order: 1,
    },
    children: {
      control: "text",
      description: "Card content",
      table: {
        category: "Content",
        type: { summary: "React.ReactNode" },
      },
      order: 1,
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This is the main content of the card.</p>
      </CardContent>
      <CardFooter>
        <p>Card footer content</p>
      </CardFooter>
    </Card>
  ),
  args: {},
};

export const WithIcon: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <BellRing className="h-5 w-5" />
          <CardTitle>Notifications</CardTitle>
        </div>
        <CardDescription>Enable notifications to stay updated</CardDescription>
      </CardHeader>
      <CardContent>
        <p>You will receive notifications about important updates.</p>
      </CardContent>
    </Card>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Use icons in the header to provide visual context for the card content.",
      },
    },
  },
};

export const UserProfile: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <div className="flex items-center space-x-4">
          <User className="h-10 w-10 rounded-full bg-slate-100 p-2" />
          <div>
            <CardTitle>John Doe</CardTitle>
            <CardDescription>Software Engineer</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p>Passionate about creating great user experiences and building scalable applications.</p>
      </CardContent>
      <CardFooter>
        <button className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">View Profile</button>
      </CardFooter>
    </Card>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Example of a user profile card with avatar, information, and actions.",
      },
    },
  },
};

export const PaymentCard: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Payment Method</CardTitle>
          <CreditCard className="h-5 w-5 text-slate-400" />
        </div>
        <CardDescription>Manage your payment information</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-slate-600">**** **** **** 1234</p>
          <p className="text-sm text-slate-600">Expires 12/25</p>
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <button className="text-sm text-slate-500 hover:text-slate-700">Edit</button>
        <button className="text-sm text-red-500 hover:text-red-700">Remove</button>
      </CardFooter>
    </Card>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Example of a payment card with sensitive information and action buttons.",
      },
    },
  },
};

export const SimpleContent: Story = {
  render: (args) => (
    <Card {...args}>
      <CardContent>
        <p>This is a simple card with just content, no header or footer.</p>
      </CardContent>
    </Card>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Use when you need a simple container with minimal structure.",
      },
    },
  },
};

export const HeaderOnly: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Header Only Card</CardTitle>
        <CardDescription>This card only has a header section</CardDescription>
      </CardHeader>
    </Card>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Use for announcements or simple information display.",
      },
    },
  },
};

export const CustomStyling: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Custom Styled Card</CardTitle>
        <CardDescription>This card has custom styling applied</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Content with custom card styling.</p>
      </CardContent>
    </Card>
  ),
  args: {
    className: "border-2 border-blue-200 bg-blue-50",
  },
  parameters: {
    docs: {
      description: {
        story: "You can customize the card appearance with additional CSS classes.",
      },
    },
  },
};

export const LongContent: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Card with Long Content</CardTitle>
        <CardDescription>This demonstrates how cards handle longer content</CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          This is a card with a longer content section to demonstrate how the card component handles extensive
          text content. The card will expand to accommodate the content while maintaining proper spacing and
          readability. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
          incididunt ut labore et dolore magna aliqua.
        </p>
      </CardContent>
      <CardFooter>
        <button className="rounded bg-slate-500 px-4 py-2 text-white hover:bg-slate-600">Read More</button>
      </CardFooter>
    </Card>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Shows how the card handles longer content with proper spacing and layout.",
      },
    },
  },
};
