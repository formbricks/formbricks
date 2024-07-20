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
    - \`dangerouslySetInnerHTML\`: Allows setting inner HTML content directly, similar to the native \`dangerouslySetInnerHTML\` in React.
                    `,
      },
    },
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    className: "",
    isInvalid: false,
    disabled: false,
    placeholder: "Enter text",
    value: "",
  },
};

export const Invalid: Story = {
  args: {
    className: "",
    isInvalid: true,
    disabled: false,
    placeholder: "Invalid input",
    value: "",
  },
};

export const Disabled: Story = {
  args: {
    className: "",
    isInvalid: false,
    disabled: true,
    placeholder: "Disabled input",
    value: "",
  },
};

export const WithValue: Story = {
  args: {
    className: "",
    isInvalid: false,
    disabled: false,
    placeholder: "Enter text",
    value: "Prefilled text",
  },
};

export const WithCustomClass: Story = {
  args: {
    className: " rounded-lg bg-gray-50 text-base ",
    isInvalid: false,
    disabled: false,
    placeholder: "Input with custom class",
    value: "",
  },
};

export const Password: Story = {
  args: {
    className: "",
    isInvalid: false,
    disabled: false,
    placeholder: "Enter password",
    value: "abcd",
    type: "password",
  },
};

export const Email: Story = {
  args: {
    className: "",
    isInvalid: false,
    disabled: false,
    placeholder: "john.doe@email.com",
    value: "",
    type: "email",
  },
};
