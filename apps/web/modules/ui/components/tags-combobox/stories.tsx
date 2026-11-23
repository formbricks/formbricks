import { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { type TTagsFieldProps, TagsField } from "./index";

/** Holds the value, so the stories behave like a real field. */
const StatefulTagsField = (props: TTagsFieldProps) => {
  const [value, setValue] = useState<string[]>([...props.value]);
  return (
    <div className="w-96">
      <TagsField {...props} value={value} onChange={setValue} />
    </div>
  );
};

const meta: Meta<typeof TagsField> = {
  title: "UI/TagsField",
  component: TagsField,
  tags: ["autodocs"],
  render: (args) => <StatefulTagsField {...args} />,
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: ["onChange"] },
    docs: {
      description: {
        component:
          'The **TagsField** is the tags combobox as a form field: chosen values show as chips inside an input-looking box. Typing opens suggestions and `+ Add "<text>"`; Enter, a comma or a semicolon adds a value; pasting `Sweden; Norway` adds two; × or Backspace in the empty field removes one. Duplicates are ignored case-insensitively. Used for Member attribute values in Member settings. The response tags\' **Add tag** button is the separate `TagsCombobox`.',
      },
    },
  },
  argTypes: {
    value: {
      control: "object",
      description: "The chosen values",
      table: { category: "Content", type: { summary: "string[]" } },
    },
    suggestions: {
      control: "object",
      description: "Values offered while typing",
      table: { category: "Content", type: { summary: "string[]" } },
    },
    placeholder: {
      control: "text",
      description: "Shown while no value is chosen",
      table: { category: "Content", defaultValue: { summary: "Add value…" } },
    },
    disabled: {
      control: "boolean",
      table: { category: "Behavior", defaultValue: { summary: "false" } },
    },
    readOnly: {
      control: "boolean",
      description: "Chips only, no input and no × buttons",
      table: { category: "Behavior", defaultValue: { summary: "false" } },
    },
    maxValues: {
      control: "number",
      table: { category: "Behavior" },
    },
    className: {
      control: "text",
      table: { category: "Appearance" },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TagsField>;

const COUNTRIES = ["Sweden", "Norway", "Denmark", "Finland", "Germany", "Spain"];

export const Default: Story = {
  args: { value: ["Sweden"], suggestions: COUNTRIES, "aria-label": "Country" },
};

export const Empty: Story = {
  args: { value: [], suggestions: COUNTRIES, "aria-label": "Country" },
};

export const Disabled: Story = {
  args: { value: ["Sweden", "Norway"], suggestions: COUNTRIES, disabled: true, "aria-label": "Country" },
};

export const ReadOnly: Story = {
  args: { value: ["Sweden", "Norway"], readOnly: true, "aria-label": "Country" },
};

export const ManyValues: Story = {
  args: {
    value: ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Västerås", "Örebro", "Linköping"],
    suggestions: ["Helsingborg", "Jönköping"],
    "aria-label": "City",
  },
};

export const AtLimit: Story = {
  args: { value: ["Sweden", "Norway"], suggestions: COUNTRIES, maxValues: 2, "aria-label": "Country" },
};
