import { useEffect } from "react";

import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";

import { Switch } from "../../Switch";
import { ColorSelectorWithLabel } from "./ColorSelectorWithLabel";

type DarModeColorProps = {
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  brandColor?: string;
  setBrandColor: React.Dispatch<React.SetStateAction<string>>;
  questionColor?: string;
  setQuestionColor: React.Dispatch<React.SetStateAction<string>>;
  inputColor?: string;
  setInputColor: React.Dispatch<React.SetStateAction<string>>;
  inputBorderColor?: string;
  setInputBorderColor: React.Dispatch<React.SetStateAction<string>>;
  cardBackgroundColor?: string;
  setCardBackgroundColor: React.Dispatch<React.SetStateAction<string>>;
  highlightBorderColor?: string;
  setHighlighBorderColor: React.Dispatch<React.SetStateAction<string>>;
  disabled?: boolean;
};

export const DarkModeColors = ({
  isDarkMode,
  setIsDarkMode,
  brandColor,
  cardBackgroundColor,
  highlightBorderColor,
  inputBorderColor,
  inputColor,
  questionColor,
  setBrandColor,
  setCardBackgroundColor,
  setHighlighBorderColor,
  setInputBorderColor,
  setInputColor,
  setQuestionColor,
  disabled = false,
}: DarModeColorProps) => {
  useEffect(() => {
    if (disabled) {
      setIsDarkMode(false);
    }
  }, [disabled, setIsDarkMode]);

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4">
      <div className="flex items-center gap-4">
        <Switch
          checked={isDarkMode}
          onCheckedChange={(value) => {
            setIsDarkMode(value);
          }}
          disabled={disabled}
        />

        <div className="flex flex-col">
          <h3 className="text-base font-semibold text-slate-900">Add &quot;Dark Mode&quot; Colors</h3>
          <p className="text-sm text-slate-800">Your app has a dark mode? Set a different set of colors.</p>
        </div>
      </div>

      {isDarkMode && (
        <div className="grid grid-cols-2 gap-4">
          <ColorSelectorWithLabel
            label="Brand color"
            color={brandColor ?? COLOR_DEFAULTS.brandColor}
            setColor={setBrandColor}
            className="gap-2"
          />
          <ColorSelectorWithLabel
            label="Text color"
            color={questionColor ?? COLOR_DEFAULTS.questionColor}
            setColor={setQuestionColor}
            className="gap-2"
          />
          <ColorSelectorWithLabel
            label="Input color"
            color={inputColor ?? COLOR_DEFAULTS.inputColor}
            setColor={setInputColor}
            className="gap-2"
          />
          <ColorSelectorWithLabel
            label="Input border color"
            color={inputBorderColor ?? COLOR_DEFAULTS.inputBorderColor}
            setColor={setInputBorderColor}
            className="gap-2"
          />
          <ColorSelectorWithLabel
            label="Card background color"
            color={cardBackgroundColor ?? COLOR_DEFAULTS.cardBackgroundColor}
            setColor={setCardBackgroundColor}
            className="gap-2"
          />
          <ColorSelectorWithLabel
            label="Highlight border color"
            color={highlightBorderColor ?? COLOR_DEFAULTS.highlightBorderColor}
            setColor={setHighlighBorderColor}
            className="gap-2"
          />
        </div>
      )}
    </div>
  );
};
