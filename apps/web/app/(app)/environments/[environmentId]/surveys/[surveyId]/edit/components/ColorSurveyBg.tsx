import { useState } from "react";

import { TSurvey } from "@formbricks/types/surveys";
import { ColorPicker } from "@formbricks/ui/ColorPicker";

interface ColorSurveyBgBgProps {
  localSurvey?: TSurvey;
  handleBgChange: (bg: string, bgType: string) => void;
  colours: string[];
}

export default function ColorSurveyBg({ localSurvey, handleBgChange, colours }: ColorSurveyBgBgProps) {
  const [color, setColor] = useState(localSurvey?.styling?.background?.bg || "#ffff");

  const handleBg = (x: string) => {
    setColor(x);
    handleBgChange(x, "color");
  };
  return (
    <div>
      <div className="w-full max-w-xs py-2">
        <ColorPicker color={color} onChange={handleBg} />
      </div>
      <div className="grid grid-cols-4 gap-4 md:grid-cols-5 xl:grid-cols-8 2xl:grid-cols-10">
        {colours.map((x) => {
          return (
            <div
              className={`h-16 w-16 cursor-pointer rounded-lg ${
                color === x ? "border-4 border-slate-500" : ""
              }`}
              key={x}
              style={{ backgroundColor: `${x}` }}
              onClick={() => handleBg(x)}></div>
          );
        })}
      </div>
    </div>
  );
}
