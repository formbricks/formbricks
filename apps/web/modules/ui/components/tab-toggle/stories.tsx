import { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { TabToggle } from "./index";

// Story options for different content scenarios
interface StoryOptions {
  optionType: "string" | "number";
  optionCount: number;
  optionLabels: string[];
  optionValues: (string | number)[];
}

type StoryProps = {
  id: string;
  disabled?: boolean;
  defaultSelected?: string | number;
} & StoryOptions;

const meta: Meta<StoryProps> = {
  title: "UI/TabToggle",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
The **TabToggle** component provides a radio button group styled as toggle buttons. It supports both string and number values and is fully accessible with proper ARIA attributes.
        `,
      },
    },
  },
  argTypes: {
    disabled: {
      control: "boolean",
      description: "Whether the toggle is disabled",
      table: {
        category: "Behavior",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    id: {
      control: "text",
      description: "Unique identifier for the toggle group",
      table: {
        category: "Behavior",
        type: { summary: "string" },
      },
    },
    defaultSelected: {
      control: "text",
      description: "Default selected value",
      table: {
        category: "Behavior",
        type: { summary: "string | number" },
      },
    },
    optionType: {
      control: "select",
      options: ["string", "number"],
      description: "Type of option values",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
    },
    optionCount: {
      control: { type: "number", min: 2, max: 6, step: 1 },
      description: "Number of toggle options",
      table: {
        category: "Content",
        type: { summary: "number" },
      },
    },
  },
};

export default meta;

type Story = StoryObj<StoryProps>;

// Wrapper component to handle state and dynamic options for stories
const TabToggleWithState = (args: StoryProps) => {
  const [selectedValue, setSelectedValue] = useState<string | number | undefined>(args.defaultSelected);

  // Generate options based on story args
  const generateOptions = () => {
    if (args.optionType === "number") {
      return Array.from({ length: args.optionCount }, (_, i) => ({
        value: i + 1,
        label: args.optionLabels[i] || `Option ${i + 1}`,
      }));
    } else {
      return Array.from({ length: args.optionCount }, (_, i) => ({
        value: args.optionValues[i] || `option${i + 1}`,
        label: args.optionLabels[i] || `Option ${i + 1}`,
      }));
    }
  };

  const options = generateOptions();

  return (
    <div className="w-64">
      <TabToggle
        id={args.id}
        options={options}
        defaultSelected={selectedValue}
        onChange={(value) => {
          setSelectedValue(value);
          console.log("Selected:", value);
        }}
        disabled={args.disabled}
      />
    </div>
  );
};

export const Default: Story = {
  render: TabToggleWithState,
  args: {
    id: "default-toggle",
    disabled: false,
    optionType: "string",
    optionCount: 3,
    optionLabels: ["Option 1", "Option 2", "Option 3"],
    optionValues: ["option1", "option2", "option3"],
    defaultSelected: "option1",
  },
};

export const TwoOptions: Story = {
  render: TabToggleWithState,
  args: {
    id: "two-options",
    disabled: false,
    optionType: "string",
    optionCount: 2,
    optionLabels: ["Yes", "No"],
    optionValues: ["yes", "no"],
    defaultSelected: "yes",
  },
  parameters: {
    docs: {
      description: {
        story: "Simple binary toggle with two options.",
      },
    },
  },
};

export const NumberValues: Story = {
  render: TabToggleWithState,
  args: {
    id: "number-toggle",
    disabled: false,
    optionType: "number",
    optionCount: 4,
    optionLabels: ["1 Month", "3 Months", "6 Months", "1 Year"],
    optionValues: [1, 3, 6, 12],
    defaultSelected: 3,
  },
  parameters: {
    docs: {
      description: {
        story: "Toggle with number values, useful for duration or quantity selection.",
      },
    },
  },
};

export const ManyOptions: Story = {
  render: TabToggleWithState,
  args: {
    id: "many-options",
    disabled: false,
    optionType: "string",
    optionCount: 5,
    optionLabels: ["XS", "S", "M", "L", "XL"],
    optionValues: ["xs", "s", "m", "l", "xl"],
    defaultSelected: "m",
  },
  parameters: {
    docs: {
      description: {
        story: "Toggle with multiple options for size selection.",
      },
    },
  },
};

export const Disabled: Story = {
  render: TabToggleWithState,
  args: {
    id: "disabled-toggle",
    disabled: true,
    optionType: "string",
    optionCount: 3,
    optionLabels: ["Basic", "Pro", "Enterprise"],
    optionValues: ["basic", "pro", "enterprise"],
    defaultSelected: "pro",
  },
  parameters: {
    docs: {
      description: {
        story: "Disabled toggle that prevents user interaction.",
      },
    },
  },
};

export const ViewModes: Story = {
  render: TabToggleWithState,
  args: {
    id: "view-modes",
    disabled: false,
    optionType: "string",
    optionCount: 3,
    optionLabels: ["List", "Grid", "Card"],
    optionValues: ["list", "grid", "card"],
    defaultSelected: "grid",
  },
  parameters: {
    docs: {
      description: {
        story: "Toggle for switching between different view modes.",
      },
    },
  },
};

export const WithoutDefault: Story = {
  render: TabToggleWithState,
  args: {
    id: "no-default",
    disabled: false,
    optionType: "string",
    optionCount: 3,
    optionLabels: ["Morning", "Afternoon", "Evening"],
    optionValues: ["morning", "afternoon", "evening"],
    defaultSelected: undefined,
  },
  parameters: {
    docs: {
      description: {
        story: "Toggle without a default selection, requiring user interaction.",
      },
    },
  },
};
