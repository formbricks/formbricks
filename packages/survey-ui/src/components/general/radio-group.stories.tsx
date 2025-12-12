import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { RadioGroup, RadioGroupItem } from "./radio-group";

const meta: Meta<typeof RadioGroup> = {
  title: "UI-package/General/RadioGroup",
  component: RadioGroup,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A radio group component built with Radix UI primitives. Allows users to select one option from a set of mutually exclusive choices.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    defaultValue: {
      control: { type: "text" },
      description: "The default selected value",
    },
    disabled: {
      control: { type: "boolean" },
      description: "Whether the entire radio group is disabled",
    },
    required: {
      control: { type: "boolean" },
      description: "Whether a selection is required",
    },
    dir: {
      control: { type: "select" },
      options: ["ltr", "rtl"],
      description: "Text direction",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args: React.ComponentProps<typeof RadioGroup>) => (
    <RadioGroup defaultValue="option1" {...args}>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option1" id="option1" />
        <Label htmlFor="option1">Option 1</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option2" id="option2" />
        <Label htmlFor="option2">Option 2</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option3" id="option3" />
        <Label htmlFor="option3">Option 3</Label>
      </div>
    </RadioGroup>
  ),
  args: {
    defaultValue: "option1",
  },
};

export const WithoutDefault: Story = {
  render: () => (
    <RadioGroup>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option1" id="no-default-1" />
        <Label htmlFor="no-default-1">Option 1</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option2" id="no-default-2" />
        <Label htmlFor="no-default-2">Option 2</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option3" id="no-default-3" />
        <Label htmlFor="no-default-3">Option 3</Label>
      </div>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="option1" disabled>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option1" id="disabled-1" />
        <Label htmlFor="disabled-1">Option 1 (Selected)</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option2" id="disabled-2" />
        <Label htmlFor="disabled-2">Option 2</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option3" id="disabled-3" />
        <Label htmlFor="disabled-3">Option 3</Label>
      </div>
    </RadioGroup>
  ),
};

export const SingleDisabledOption: Story = {
  render: () => (
    <RadioGroup defaultValue="option1">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option1" id="single-disabled-1" />
        <Label htmlFor="single-disabled-1">Option 1</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option2" id="single-disabled-2" disabled />
        <Label htmlFor="single-disabled-2">Option 2 (Disabled)</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option3" id="single-disabled-3" />
        <Label htmlFor="single-disabled-3">Option 3</Label>
      </div>
    </RadioGroup>
  ),
};

export const PaymentMethod: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Payment Method</h3>
      <RadioGroup defaultValue="credit-card">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="credit-card" id="credit-card" />
          <Label htmlFor="credit-card">Credit Card</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="paypal" id="paypal" />
          <Label htmlFor="paypal">PayPal</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="bank-transfer" id="bank-transfer" />
          <Label htmlFor="bank-transfer">Bank Transfer</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="crypto" id="crypto" disabled />
          <Label htmlFor="crypto">Cryptocurrency (Coming Soon)</Label>
        </div>
      </RadioGroup>
    </div>
  ),
};

export const SurveyElement: Story = {
  render: () => (
    <div className="w-[400px] space-y-4">
      <div>
        <h3 className="text-lg font-medium">How satisfied are you with our service?</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Please select one option that best describes your experience.
        </p>
      </div>
      <RadioGroup>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="very-satisfied" id="very-satisfied" />
          <Label htmlFor="very-satisfied">Very satisfied</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="satisfied" id="satisfied" />
          <Label htmlFor="satisfied">Satisfied</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="neutral" id="neutral" />
          <Label htmlFor="neutral">Neutral</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="dissatisfied" id="dissatisfied" />
          <Label htmlFor="dissatisfied">Dissatisfied</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="very-dissatisfied" id="very-dissatisfied" />
          <Label htmlFor="very-dissatisfied">Very dissatisfied</Label>
        </div>
      </RadioGroup>
    </div>
  ),
};

export const WithDescriptions: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Choose your plan</h3>
      <RadioGroup defaultValue="basic">
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="basic" id="plan-basic" />
            <Label htmlFor="plan-basic" className="font-medium">
              Basic Plan
            </Label>
          </div>
          <p className="text-muted-foreground ml-6 text-sm">
            Perfect for individuals. Includes basic features and 5GB storage.
          </p>
          <p className="ml-6 text-sm font-medium">$9/month</p>
        </div>
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="pro" id="plan-pro" />
            <Label htmlFor="plan-pro" className="font-medium">
              Pro Plan
            </Label>
          </div>
          <p className="text-muted-foreground ml-6 text-sm">
            Great for small teams. Advanced features and 50GB storage.
          </p>
          <p className="ml-6 text-sm font-medium">$29/month</p>
        </div>
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="enterprise" id="plan-enterprise" />
            <Label htmlFor="plan-enterprise" className="font-medium">
              Enterprise Plan
            </Label>
          </div>
          <p className="text-muted-foreground ml-6 text-sm">
            For large organizations. Custom features and unlimited storage.
          </p>
          <p className="ml-6 text-sm font-medium">Contact sales</p>
        </div>
      </RadioGroup>
    </div>
  ),
};

export const Required: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">
          Gender <span className="text-red-500">*</span>
        </h3>
        <p className="text-muted-foreground text-sm">This field is required</p>
      </div>
      <RadioGroup required>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="male" id="gender-male" />
          <Label htmlFor="gender-male">Male</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="female" id="gender-female" />
          <Label htmlFor="gender-female">Female</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="other" id="gender-other" />
          <Label htmlFor="gender-other">Other</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="prefer-not-to-say" id="gender-prefer-not" />
          <Label htmlFor="gender-prefer-not">Prefer not to say</Label>
        </div>
      </RadioGroup>
    </div>
  ),
};

export const WithRTL: Story = {
  render: () => (
    <div className="space-y-4">
      <RadioGroup dir="rtl" required>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="male" id="gender-male" />
          <Label htmlFor="gender-male">Male</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="female" id="gender-female" />
          <Label htmlFor="gender-female">Female</Label>
        </div>
      </RadioGroup>
    </div>
  ),
};

export const WithErrorMessage: Story = {
  render: () => (
    <RadioGroup errorMessage="Please select an option">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option1" id="option1" />
        <Label htmlFor="option1">Option 1</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option2" id="option2" />
        <Label htmlFor="option2">Option 2</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option3" id="option3" />
        <Label htmlFor="option3">Option 3</Label>
      </div>
    </RadioGroup>
  ),
};

export const WithErrorMessageAndRTL: Story = {
  render: () => (
    <RadioGroup errorMessage="يرجى اختيار الخيار" dir="rtl">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option1" id="option1" />
        <Label htmlFor="option1">اختر الخيار 1</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option2" id="option2" />
        <Label htmlFor="option2">اختر الخيار 2</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option3" id="option3" />
        <Label htmlFor="option3">اختر الخيار 3</Label>
      </div>
    </RadioGroup>
  ),
};
