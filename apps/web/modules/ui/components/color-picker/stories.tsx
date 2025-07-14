import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { ColorPicker } from "./index";

const meta: Meta<typeof ColorPicker> = {
  title: "ui/ColorPicker",
  component: ColorPicker,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    function Component(Story, ctx) {
      const [, setArgs] = useArgs<typeof ctx.args>();

      const handleChange = (newColor: string) => {
        ctx.args.onChange?.(newColor);
        setArgs({ color: newColor });
      };

      return <Story args={{ ...ctx.args, onChange: handleChange }} />;
    },
  ],
  argTypes: {
    color: {
      control: "color",
    },
  },
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof ColorPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    color: "#f24768",
    containerClass: "mb-20",
  },
};
