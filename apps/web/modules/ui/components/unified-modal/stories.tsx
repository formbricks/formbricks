import type { Meta, StoryObj } from "@storybook/react";
import { AlertCircle } from "lucide-react";
import { Button } from "../button";
import {
  MyDialog,
  MyDialogContent,
  MyDialogDescription,
  MyDialogFooter,
  MyDialogHeader,
  MyDialogTitle,
  MyDialogTrigger,
} from "./index";

interface ModalStoryProps {
  icon: boolean;
  triggerText: string;
  title: string;
  description: string;
}

const ModalStory = ({ triggerText, title, description }: ModalStoryProps) => (
  <MyDialog>
    <MyDialogTrigger asChild>
      <Button variant="outline">{triggerText}</Button>
    </MyDialogTrigger>
    <MyDialogContent>
      <MyDialogHeader>
        <AlertCircle />
        <MyDialogTitle>{title}</MyDialogTitle>
        <MyDialogDescription>{description}</MyDialogDescription>
      </MyDialogHeader>
      Hello
      <MyDialogFooter>
        <Button variant="ghost">Cancel</Button>
        <Button variant="secondary">Confirm</Button>
        <Button className="self-start">Confirm</Button>
      </MyDialogFooter>
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
    icon: {
      control: "boolean",
      description: "Whether to show an icon in the header",
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
  },
} satisfies Meta<typeof ModalStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    triggerText: "Open Modal",
    title: "Modal Title",
    description: "This is a description of what this modal is for.",
  },
};
