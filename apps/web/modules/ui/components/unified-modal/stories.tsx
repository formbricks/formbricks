import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../button";
import {
  MyDialog,
  MyDialogContent,
  MyDialogDescription,
  MyDialogHeader,
  MyDialogTitle,
  MyDialogTrigger,
} from "./index";

interface ModalStoryProps {
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
        <MyDialogTitle>{title}</MyDialogTitle>
        <MyDialogDescription>{description}</MyDialogDescription>
      </MyDialogHeader>
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
