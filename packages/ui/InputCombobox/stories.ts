import { Meta, StoryObj } from "@storybook/react";
import { InputCombobox } from "./index";

const meta = {
  title: "UI/InputCombobox",
  component: InputCombobox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
            The \`InputCombobox\` component is a combination of an input field and a dropdown menu.
            It supports various features such as:
            - Searchable options
            - Grouped options
            - Multi-select
            - Customizable size
            - Custom input props
        `,
      },
    },
  },
} satisfies Meta<typeof InputCombobox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    showSearch: true,
    searchPlaceholder: "Search...",
    options: [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
      { label: "Option 3", value: "option3" },
    ],
    value: null,
    onChangeValue: (option) => console.log(option),
    withInput: false,
    allowMultiSelect: false,
  },
};

export const WithInput: Story = {
  args: {
    ...Default.args,
    withInput: true,
    inputProps: {
      placeholder: "Enter text",
    },
  },
};

export const Grouped: Story = {
  args: {
    ...Default.args,
    groupedOptions: [
      {
        label: "Group 1",
        value: "group1",
        options: [
          { label: "Option 1", value: "option1" },
          { label: "Option 2", value: "option2" },
        ],
      },
      {
        label: "Group 2",
        value: "group2",
        options: [
          { label: "Option 3", value: "option3" },
          { label: "Option 4", value: "option4" },
        ],
      },
    ],
  },
};

export const MultiSelect: Story = {
  args: {
    ...Default.args,
    allowMultiSelect: true,
    value: ["option1", "option3"],
  },
};

export const SmallSize: Story = {
  args: {
    ...Default.args,
  },
};
