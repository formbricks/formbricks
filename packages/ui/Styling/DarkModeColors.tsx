import { ColorPicker } from "../ColorPicker";
import { Switch } from "../Switch";

const colorDefaults = {
  brandColor: "#64748b",
  questionColor: "#2b2524",
  inputColor: "#efefef",
  inputBorderColor: "#c0c0c0",
  cardBackgroundColor: "#c0c0c0",
  highlightBorderColor: "#64748b",
};

const ColorSelectorWithLabel = ({
  label,
  color,
  setColor,
}: {
  label: string;
  color: string;
  setColor: React.Dispatch<React.SetStateAction<string>>;
}) => {
  return (
    <div className="flex flex-col">
      <h3 className="text-base font-semibold text-slate-900">{label}</h3>
      <ColorPicker color={color} onChange={setColor} />
    </div>
  );
};

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
};

const DarkModeColors = ({
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
}: DarModeColorProps) => {
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4">
      <div className="flex items-center gap-4">
        <Switch
          checked={isDarkMode}
          onCheckedChange={(value) => {
            setIsDarkMode(value);
          }}
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
            color={brandColor ?? colorDefaults.brandColor}
            setColor={setBrandColor}
          />
          <ColorSelectorWithLabel
            label="Question color"
            color={questionColor ?? colorDefaults.questionColor}
            setColor={setQuestionColor}
          />
          <ColorSelectorWithLabel
            label="Input color"
            color={inputColor ?? colorDefaults.inputColor}
            setColor={setInputColor}
          />
          <ColorSelectorWithLabel
            label="Input border color"
            color={inputBorderColor ?? colorDefaults.inputBorderColor}
            setColor={setInputBorderColor}
          />
          <ColorSelectorWithLabel
            label="Card background color"
            color={cardBackgroundColor ?? colorDefaults.cardBackgroundColor}
            setColor={setCardBackgroundColor}
          />
          <ColorSelectorWithLabel
            label="Highlight border color"
            color={highlightBorderColor ?? colorDefaults.highlightBorderColor}
            setColor={setHighlighBorderColor}
          />
        </div>
      )}
    </div>
  );
};

export default DarkModeColors;
