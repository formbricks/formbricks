import { Meta, StoryObj } from "@storybook/react-vite";
import { FileIcon, FolderIcon, ImageIcon } from "lucide-react";
import { logger } from "@formbricks/logger";
import { InputCombobox } from "./index";

interface StoryOptions {
  numberOfOptions: number;
  showCustomIcons: boolean;
  enableMultiSelect: boolean;
  enableClearable: boolean;
}

type StoryProps = React.ComponentProps<typeof InputCombobox> & StoryOptions;

const meta: Meta<StoryProps> = {
  title: "UI/InputCombobox",
  component: InputCombobox,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: [] },
    docs: {
      description: {
        component:
          "The **InputCombobox** component is a versatile combination of an input field and a dropdown menu. It supports searchable options, grouped options, multi-select, icons, clearable selection, and both dropdown and input modes.",
      },
    },
  },
  argTypes: {
    allowMultiSelect: {
      control: "boolean",
      description: "Allow selecting multiple options",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 1,
    },
    clearable: {
      control: "boolean",
      description: "Allow clearing the selection",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 2,
    },
    showSearch: {
      control: "boolean",
      description: "Show search input in dropdown",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
      order: 3,
    },
    withInput: {
      control: "boolean",
      description: "Include input field alongside dropdown",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 4,
    },
    showCheckIcon: {
      control: "boolean",
      description: "Show check icon for selected items",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
      order: 5,
    },
    onChangeValue: {
      action: "value changed",
      description: "Callback when value changes",
      table: {
        category: "Behavior",
        type: { summary: "function" },
      },
      order: 6,
    },
    comboboxClasses: {
      control: "text",
      description: "Additional CSS classes for the combobox",
      table: {
        category: "Appearance",
        type: { summary: "string" },
      },
      order: 1,
    },
    searchPlaceholder: {
      control: "text",
      description: "Placeholder text for search input",
      table: {
        category: "Content",
        type: { summary: "string" },
        defaultValue: { summary: "Search..." },
      },
      order: 1,
    },
    emptyDropdownText: {
      control: "text",
      description: "Text to show when no options found",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 2,
    },
    id: {
      control: "text",
      description: "Unique identifier for the component",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
      order: 3,
    },
  },
};

export default meta;
type Story = StoryObj<typeof InputCombobox>;

const commonOptions = [
  { label: "File", value: "file", icon: FileIcon },
  { label: "Folder", value: "folder", icon: FolderIcon },
  { label: "Image", value: "image", icon: ImageIcon },
];

const simpleOptions = [
  { label: "Option 1", value: "option1" },
  { label: "Option 2", value: "option2" },
  { label: "Option 3", value: "option3" },
];

export const Default: Story = {
  args: {
    id: "input-combobox-default",
    showSearch: true,
    searchPlaceholder: "Search...",
    options: commonOptions,
    value: commonOptions[0].value,
    onChangeValue: (value, option) => logger.debug({ value, option }, "onChangeValue"),
    clearable: false,
    withInput: false,
    allowMultiSelect: false,
    showCheckIcon: true,
  },
};

export const WithInput: Story = {
  args: {
    id: "input-combobox-with-input",
    showSearch: true,
    options: commonOptions,
    value: null,
    onChangeValue: (value, option) => logger.debug({ value, option }, "onChangeValue"),
    withInput: true,
    inputProps: {
      placeholder: "Type or select an option",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Use when you need both dropdown selection and free text input functionality.",
      },
    },
  },
};

export const MultiSelect: Story = {
  args: {
    id: "input-combobox-multi-select",
    options: commonOptions,
    value: ["file", "image"],
    onChangeValue: (value, option) => logger.debug({ value, option }, "onChangeValue"),
    allowMultiSelect: true,
    showCheckIcon: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Use when users need to select multiple options from the dropdown.",
      },
    },
  },
};

export const Clearable: Story = {
  args: {
    id: "input-combobox-clearable",
    options: commonOptions,
    value: "folder",
    onChangeValue: (value, option) => logger.debug({ value, option }, "onChangeValue"),
    clearable: true,
    showCheckIcon: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Use when users should be able to clear their selection.",
      },
    },
  },
};

export const GroupedOptions: Story = {
  args: {
    id: "input-combobox-grouped",
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
          { label: "Security", value: "security" },
        ],
      },
    ],
    value: null,
    onChangeValue: (value, option) => logger.debug({ value, option }, "onChangeValue"),
    showCheckIcon: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Use when you need to organize options into logical groups.",
      },
    },
  },
};

export const WithoutSearch: Story = {
  args: {
    id: "input-combobox-no-search",
    options: simpleOptions,
    value: null,
    onChangeValue: (value, option) => logger.debug({ value, option }, "onChangeValue"),
    showSearch: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Use when you have a small number of options and don't need search functionality.",
      },
    },
  },
};

export const ManyOptions: Story = {
  args: {
    id: "input-combobox-many-options",
    options: Array.from({ length: 50 }, (_, i) => ({
      label: `Option ${i + 1}`,
      value: `option${i + 1}`,
    })),
    value: null,
    onChangeValue: (value, option) => logger.debug({ value, option }, "onChangeValue"),
    showSearch: true,
    searchPlaceholder: "Search from 50 options...",
  },
  parameters: {
    docs: {
      description: {
        story: "Use when you have many options and need search functionality for better UX.",
      },
    },
  },
};

export const CustomStyling: Story = {
  args: {
    id: "input-combobox-custom",
    options: commonOptions,
    value: null,
    onChangeValue: (value, option) => logger.debug({ value, option }, "onChangeValue"),
    comboboxClasses: "border-blue-300 hover:border-blue-400",
    showCheckIcon: true,
  },
  parameters: {
    docs: {
      description: {
        story: "You can customize the appearance with custom CSS classes.",
      },
    },
  },
};

export const EmptyState: Story = {
  args: {
    id: "input-combobox-empty",
    options: [],
    value: null,
    onChangeValue: (value, option) => logger.debug({ value, option }, "onChangeValue"),
    emptyDropdownText: "No options available",
  },
  parameters: {
    docs: {
      description: {
        story: "Shows how the component handles empty options list.",
      },
    },
  },
};
