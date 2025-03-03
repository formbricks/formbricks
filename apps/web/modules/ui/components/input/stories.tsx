import { Meta, StoryObj } from "@storybook/react";
import { Input } from "./index";

const meta = {
  title: "ui/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
            The \`Input\` component is used to input the form fields.
    It supports all standard HTML input attributes, along with some additional props to handle specific use cases:
    - \`isInvalid\`: Adds a visual indicator for invalid input.
    - \`crossOrigin\`: Specifies how the element handles cross-origin requests.
    - \`dangerouslySetInnerHTML\`: Allows setting inner HTML content directly, similar to the native \`dangerouslySetInnerHTML\` in React.`,
      },
    },
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: "",
    className: "",
    isInvalid: false,
    disabled: false,
    placeholder: "Enter text",
  },
};

export const Invalid: Story = {
  args: {
    isInvalid: true,
    disabled: false,
    placeholder: "Invalid input",
  },
};

export const Disabled: Story = {
  args: {
    isInvalid: false,
    disabled: true,
    placeholder: "Disabled input",
  },
};

export const WithValue: Story = {
  args: {
    value: "Prefilled text",
    isInvalid: false,
    disabled: false,
    placeholder: "Enter text",
  },
};

export const WithCustomClass: Story = {
  args: {
    className: "rounded-lg bg-slate-50 text-base",
    isInvalid: false,
    disabled: false,
    placeholder: "Input with custom class",
  },
};

export const Password: Story = {
  args: {
    type: "password",
    value: "abcd",
    isInvalid: false,
    disabled: false,
    placeholder: "Enter password",
  },
};

export const Email: Story = {
  args: {
    type: "email",
    isInvalid: false,
    disabled: false,
    placeholder: "john.doe@email.com",
  },
};
