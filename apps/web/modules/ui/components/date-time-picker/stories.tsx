import { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { DateTimePicker, validateDateTimeRange } from "./index";

type StoryProps = React.ComponentProps<typeof DateTimePicker>;

const meta: Meta<StoryProps> = {
  title: "UI/DateTimePicker",
  component: DateTimePicker,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: { sort: "alpha", exclude: ["value", "onChange", "minDate"] },
    docs: {
      description: {
        component:
          'The **DateTimePicker** picks a date and a time to the minute, in the editor\'s own time zone. The trigger follows the outline button; the popover is the Calendar plus a typed time field ("23:59", "11:59 PM", "2pm"), Today and Clear. Range rules belong to the form: validate with `validateDateTimeRange` and pass the message as `error`.',
      },
    },
  },
  argTypes: {
    disabled: {
      control: "boolean",
      description: "Disables the trigger",
      table: { category: "Behavior", type: { summary: "boolean" }, defaultValue: { summary: "false" } },
    },
    locale: {
      control: "text",
      description: "App locale code used to format the value; never a browser default",
      table: { category: "Behavior", type: { summary: "string" } },
    },
    align: {
      control: "select",
      options: ["start", "center", "end"],
      description: "Popover alignment against the trigger",
      table: { category: "Appearance", type: { summary: "string" }, defaultValue: { summary: "start" } },
    },
    className: {
      control: "text",
      description: "Classes for the wrapper around the trigger and its error",
      table: { category: "Appearance", type: { summary: "string" } },
    },
    placeholder: {
      control: "text",
      description: 'Shown when there is no value, e.g. "Starts immediately"',
      table: { category: "Content", type: { summary: "string" } },
    },
    label: {
      control: "text",
      description: 'The field\'s name for assistive tech; the trigger reads as "<label>: <value>"',
      table: { category: "Content", type: { summary: "string" } },
    },
    error: {
      control: "text",
      description: "The field's error, shown under the trigger and linked to it",
      table: { category: "Content", type: { summary: "string" } },
    },
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

const PickerWithValue = (args: StoryProps) => {
  const [value, setValue] = useState(args.value);

  return (
    <div className="w-72">
      <DateTimePicker {...args} value={value} onChange={setValue} />
    </div>
  );
};

const nineToday = () => {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  return date;
};

export const Default: Story = {
  render: PickerWithValue,
  args: { value: null, locale: "en-US", label: "Starts", placeholder: "Starts immediately" },
};

export const Disabled: Story = {
  render: PickerWithValue,
  args: { value: nineToday(), locale: "en-US", label: "Starts", disabled: true },
};

export const WithValue: Story = {
  render: PickerWithValue,
  args: { value: nineToday(), locale: "en-US", label: "Starts" },
};

export const WithError: Story = {
  render: PickerWithValue,
  args: {
    value: nineToday(),
    locale: "en-US",
    label: "Ends",
    error: "The end must be after the start",
  },
  parameters: {
    docs: { description: { story: "The form hands its range error back; it is linked to the trigger." } },
  },
};

const RangeExample = () => {
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const rangeError = validateDateTimeRange(start, end);

  return (
    <div className="flex w-72 flex-col gap-3">
      <DateTimePicker
        locale="en-US"
        label="Starts"
        placeholder="Starts immediately"
        value={start}
        onChange={setStart}
      />
      <DateTimePicker
        locale="en-US"
        label="Ends"
        placeholder="No end"
        value={end}
        onChange={setEnd}
        minDate={start ?? undefined}
        error={rangeError ? "The end must be after the start" : undefined}
      />
    </div>
  );
};

export const Range: Story = {
  render: () => <RangeExample />,
  parameters: {
    docs: {
      description: {
        story:
          "A start/end pair: days before the start can't be picked for the end, and an end at or before the start shows the error.",
      },
    },
  },
};
