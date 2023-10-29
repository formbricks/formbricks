import { useState } from "react";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { Label } from "@formbricks/ui/Label";
import FileInput from "@formbricks/ui/FileInput";

export default function ImageSurveyBg({ localSurvey, handleBgChange }) {
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

  // const handleBg = (x: string) => {
  //   setColor(x);
  //   handleBgChange(x,"image");
  // };
  return (
    <div className="mb-2 mt-4 w-full rounded-lg border bg-slate-50 p-4">
      <div className="mt-3 flex w-full items-center justify-center">
        <FileInput
          allowedFileExtensions={["png", "jpeg", "jpg"]}
          environmentId={localSurvey.environmentId}
          onFileUpload={(url: string) => {
            handleBgChange(url, "image");
          }}
          fileUrl={localSurvey?.welcomeCard?.fileUrl}
        />
      </div>
    </div>
  );
}
