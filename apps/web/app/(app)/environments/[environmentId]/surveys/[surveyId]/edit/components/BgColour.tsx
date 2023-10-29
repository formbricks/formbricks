import { useState } from "react";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { Label } from "@formbricks/ui/Label";

export default function BgColour({ localSurvey, handleBgChange }) {
  const colours = [
    "#FFF2D8",
    "#EAD7BB",
    "#BCA37F",
    "#113946",
    "#04364A",
    "#176B87",
    "#64CCC5",
    "#DAFFFB",
    "#132043",
    "#1F4172",
    "#F1B4BB",
    "#FDF0F0",
    "#001524",
    "#445D48",
    "#D6CC99",
    "#FDE5D4",
    "#BEADFA",
    "#D0BFFF",
    "#DFCCFB",
    "#FFF8C9",
    "#FF8080",
    "#FFCF96",
    "#F6FDC3",
    "#CDFAD5",
  ];

  const [color, setColor] = useState(localSurvey.surveyBackground?.bgColor || "#ffff");

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
              className={`h-16 w-16 cursor-pointer ${color === x ? "border-2 border-slate-500" : ""}`}
              key={x}
              style={{ backgroundColor: `${x}` }}
              onClick={() => handleBg(x)}></div>
          );
        })}
      </div>
    </div>
  );
}
