import { useState } from "react";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { Label } from "@formbricks/ui/Label";
import { TSurvey } from "@formbricks/types/surveys";

interface ColorSurveyBgBgProps {
  localSurvey?: TSurvey;
  handleBgChange: (bg: string, bgType: string) => void;
  colours: string[];
}

export default function ColorSurveyBg({ localSurvey, handleBgChange, colours }: ColorSurveyBgBgProps) {
  const [color, setColor] = useState(localSurvey?.surveyBackground?.bg || "#ffff");

  const handleBg = (x: string) => {
    setColor(x);
    handleBgChange(x, "color");
  };
  return (
    <div>
      <div className="mb-2 mt-4 rounded-lg border bg-slate-50 p-4">
        <div className="w-full max-w-xs">
          <Label htmlFor="brandcolor">Color (HEX)</Label>
          <ColorPicker color={color} onChange={handleBg} />
        </div>
      </div>
      <div className="grid grid-cols-6 gap-4">
        {colours.map((x) => {
          return (
            <div
              className={`h-16 w-16 cursor-pointer ${color === x ? "border-4 border-slate-500" : ""}`}
              key={x}
              style={{ backgroundColor: `${x}` }}
              onClick={() => handleBg(x)}></div>
          );
        })}
      </div>
    </div>
  );
}
