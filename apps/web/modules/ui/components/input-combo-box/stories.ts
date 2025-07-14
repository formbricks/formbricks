import { Meta, StoryObj } from "@storybook/react-vite";
import { FileIcon, FolderIcon, ImageIcon } from "lucide-react";
import { logger } from "@formbricks/logger";
import { InputCombobox } from "./index";

const meta = {
  title: "UI/InputCombobox",
  component: InputCombobox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
          The \`InputCombobox\` component is a versatile combination of an input field and a dropdown menu.
          It supports various features such as:
          - Searchable options
          - Grouped options
          - Multi-select
          - Icons for options
          - Clearable selection
          - Custom input props
          - Handling both dropdown and input modes
        `,
      },
    },
  },
} satisfies Meta<typeof InputCombobox>;

export default meta;
type Story = StoryObj<typeof meta>;

const commonOptions = [
  { label: "File", value: "file", icon: FileIcon },
  { label: "Folder", value: "folder", icon: FolderIcon },
  { label: "Image", value: "image", icon: ImageIcon },
];

export const Default: Story = {
  args: {
    id: "input-combobox-default",
    showSearch: true,
    searchPlaceholder: "Search...",
    options: commonOptions,
    value: null,
    onChangeValue: (value, option) => logger.debug({ value, option }, "onChangeValue"),
    clearable: true,
    withInput: false,
    allowMultiSelect: false,
    showCheckIcon: true,
  },
};

export const WithInput: Story = {
  args: {
    ...Default.args,
    withInput: true,
    inputProps: {
      placeholder: "Type or select an option",
    },
  },
};

export const GroupedOptions: Story = {
  args: {
    ...Default.args,
    groupedOptions: [
      {
        label: "Common",
        value: "common",
        options: commonOptions,
      },
      {
        label: "Advanced",
        value: "advanced",
        options: [
          { label: "Database", value: "database" },
          { label: "Network", value: "network" },
        ],
      },
    ],
  },
};

export const MultiSelect: Story = {
  args: {
    ...Default.args,
    allowMultiSelect: true,
    value: ["file", "image"],
  },
};

export const Clearable: Story = {
  args: {
    ...Default.args,
    value: "folder",
    clearable: true,
  },
};

export const WithoutSearch: Story = {
  args: {
    ...Default.args,
    showSearch: false,
  },
};
