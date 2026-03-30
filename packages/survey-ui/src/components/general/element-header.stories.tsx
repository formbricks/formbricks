import { type Meta, type StoryObj } from "@storybook/react";
import { ElementHeader } from "./element-header";

const meta: Meta<typeof ElementHeader> = {
  title: "UI-package/General/ElementHeader",
  component: ElementHeader,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    headline: {
      control: "text",
      description: "The main headline text",
    },
    description: {
      control: "text",
      description: "Optional description text displayed below the headline",
    },
    required: {
      control: "boolean",
      description: "Whether the field is required (shows asterisk)",
    },
    htmlFor: {
      control: "text",
      description: "The id of the form control this header is associated with",
    },
    imageUrl: {
      control: "text",
      description: "URL of an image to display above the headline",
    },
    videoUrl: {
      control: "text",
      description: "URL of a video (YouTube, Vimeo, or Loom) to display above the headline",
    },
    imageAltText: {
      control: "text",
      description: "Alt text for the image",
    },
  },
  args: {
    headline: "Element Title",
  },
};

export default meta;
type Story = StoryObj<typeof ElementHeader>;

export const Default: Story = {
  args: {
    headline: "What is your name?",
  },
};

export const WithDescription: Story = {
  args: {
    headline: "How satisfied are you?",
    description: "Please rate your experience from 1 to 10",
  },
};

export const Required: Story = {
  args: {
    headline: "Email Address",
    required: true,
  },
};

export const RequiredWithDescription: Story = {
  args: {
    headline: "Phone Number",
    description: "We'll use this to contact you about your order",
    required: true,
  },
};

export const WithHtmlFor: Story = {
  render: () => (
    <div className="space-y-4">
      <ElementHeader headline="Username" description="Choose a unique username" htmlFor="username" />
      <input id="username" type="text" placeholder="Enter username" className="rounded border px-3 py-2" />
    </div>
  ),
};

export const WithImage: Story = {
  args: {
    headline: "What do you see in this image?",
    description: "Please describe what you observe",
    imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
    imageAltText: "Mountain landscape",
  },
};

export const WithVideo: Story = {
  args: {
    headline: "Watch this video",
    description: "Please watch the video and answer the questions below",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
};

export const WithImageAndDescription: Story = {
  args: {
    headline: "Rate this design",
    description: "On a scale of 1-10, how would you rate this design?",
    required: true,
    imageUrl: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop",
    imageAltText: "Design mockup",
  },
};
