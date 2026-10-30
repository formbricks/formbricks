import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { EMPTY_SIGNATURE, type SignatureValue, clearSignature } from "../../lib/signature/signature-model";
import {
  type BaseStylingOptions,
  type InputLayoutStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  elementStylingArgTypes,
  inputStylingArgTypes,
  pickArgTypes,
} from "../../lib/story-helpers";
import { Signature, type SignatureProps } from "./signature";

type StoryProps = SignatureProps &
  Partial<BaseStylingOptions & InputLayoutStylingOptions> &
  Record<string, unknown>;

// The Storybook static dir serves the surveys package's font folder at the path the real app uses.
const TYPED_FONT_URL = "/js/fonts/FormbricksSignatureScript-latin.woff2";

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/Signature",
  component: Signature,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A signature pad. The respondent draws with a finger, stylus or mouse, or (when typed signatures are allowed) switches to Type and enters their name. The element is controlled: it takes a `value` of normalised strokes and a typed name and reports every change through `onChange`; the image itself is produced by `exportSignaturePng` when the survey is submitted. The pad is a fixed 3:1 white page with near-black ink in every theme, because it is what the exported PNG looks like.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [createCSSVariablesDecorator<StoryProps>()],
  argTypes: {
    ...commonArgTypes,
    allowTypedSignature: {
      control: "boolean",
      description: "Show the Draw / Type toggle and let the respondent type their name",
      table: { category: "Behavior" },
    },
    hasSavedSignature: {
      control: "boolean",
      description: "A signature was saved earlier and only its URL is left (shows the saved state)",
      table: { category: "State" },
    },
    isUploading: {
      control: "boolean",
      description: "The signature image is uploading",
      table: { category: "State" },
    },
    typedFontUrl: {
      control: "text",
      description: "Where the typed-signature font is fetched from the first time the Type tab opens",
      table: { category: "Content" },
    },
    ...elementStylingArgTypes,
    ...pickArgTypes(inputStylingArgTypes, [
      "inputBgColor",
      "inputBorderColor",
      "inputTextColor",
      "inputFontSize",
      "inputFontWeight",
      "inputWidth",
      "inputHeight",
      "inputBorderRadius",
      "inputPaddingX",
      "inputPaddingY",
    ]),
  },
  args: {
    elementId: "signature-element",
    inputId: "signature-input",
    value: EMPTY_SIGNATURE,
    typedFontUrl: TYPED_FONT_URL,
  },
  render: function Render(args: StoryProps) {
    const [value, setValue] = useState<SignatureValue>(args.value);
    const [saved, setSaved] = useState(Boolean(args.hasSavedSignature));

    useEffect(() => {
      setValue(args.value);
    }, [args.value]);
    useEffect(() => {
      setSaved(Boolean(args.hasSavedSignature));
    }, [args.hasSavedSignature]);

    return (
      <div className="w-[640px] max-w-full">
        <Signature
          {...args}
          value={value}
          hasSavedSignature={saved}
          onChange={(next) => {
            setValue(next);
            args.onChange?.(next);
          }}
          onClear={() => {
            setSaved(false);
            setValue((current) => clearSignature(current));
          }}
        />
      </div>
    );
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

export const Default: Story = {
  args: {
    headline: "Sign here",
    description: "Draw your signature with your finger, a stylus or a mouse",
    required: true,
  },
};

export const DrawOnly: Story = {
  args: {
    headline: "Sign here",
    allowTypedSignature: false,
  },
};

export const TypedName: Story = {
  args: {
    headline: "Sign here",
    value: { mode: "type", strokes: [], typedName: "Ada Lovelace" },
  },
};

export const Required: Story = {
  args: {
    headline: "Please sign to confirm",
    required: true,
  },
};

export const WithError: Story = {
  args: {
    headline: "Please sign to confirm",
    required: true,
    errorMessage: "Please fill out this field.",
  },
};

export const SavedSignature: Story = {
  args: {
    headline: "Sign here",
    hasSavedSignature: true,
  },
};

export const Uploading: Story = {
  args: {
    headline: "Sign here",
    isUploading: true,
    value: {
      mode: "draw",
      strokes: [
        [
          { x: 0.15, y: 0.6 },
          { x: 0.3, y: 0.3 },
          { x: 0.45, y: 0.65 },
          { x: 0.6, y: 0.35 },
          { x: 0.8, y: 0.55 },
        ],
      ],
      typedName: "",
    },
  },
};

export const Disabled: Story = {
  args: {
    headline: "This signature pad is disabled",
    disabled: true,
  },
};

export const RTL: Story = {
  args: {
    headline: "وقّع هنا",
    description: "ارسم توقيعك بإصبعك أو بالقلم أو بالفأرة",
    dir: "rtl",
    labels: {
      clear: "مسح",
      draw: "رسم",
      type: "كتابة",
      typeYourName: "اكتب اسمك",
      signHere: "وقّع هنا",
    },
  },
};
