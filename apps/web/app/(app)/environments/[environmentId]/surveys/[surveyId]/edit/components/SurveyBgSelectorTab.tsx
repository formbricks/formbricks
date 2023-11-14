import { useState } from "react";
import ImageSurveyBg from "./ImageSurveyBg";
import AnimatedSurveyBg from "./AnimatedSurveyBg";
import ColorSurveyBg from "./ColorSurveyBg";
import { TSurvey } from "@formbricks/types/surveys";

interface SurveyBgSelectorTabProps {
  localSurvey: TSurvey;
  handleBgChange: (bg: string, bgType: string) => void;
  colours: string[];
  bgType: string | null | undefined;
}

export default function SurveyBgSelectorTab({
  localSurvey,
  handleBgChange,
  colours,
  bgType,
}: SurveyBgSelectorTabProps) {
  const [tab, setTab] = useState(bgType || "image");

  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-lg border bg-slate-50 p-4 px-8">
      <div className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-6 py-1.5">
        <button
          className={
            tab === "image"
              ? "w-1/4 rounded-md bg-white  p-2 text-sm font-medium leading-none text-slate-800 shadow-sm"
              : "w-1/4 rounded-md  p-2 text-sm font-medium leading-none text-slate-800"
          }
          onClick={() => setTab("image")}>
          Image
        </button>
        <button
          className={
            tab === "animation"
              ? "w-1/4 rounded-md bg-white p-2 text-sm font-medium leading-none text-slate-800 shadow-sm"
              : "w-1/4 rounded-md p-2 text-sm font-medium leading-none text-slate-800"
          }
          onClick={() => setTab("animation")}>
          Animation
        </button>
        <button
          className={
            tab === "color"
              ? "w-1/4 rounded-md bg-white p-2 text-sm font-medium leading-none text-slate-800 shadow-sm"
              : "w-1/4 rounded-md p-2 text-sm font-medium leading-none text-slate-800"
          }
          onClick={() => setTab("color")}>
          Color
        </button>
      </div>
      {tab === "image" ? (
        <ImageSurveyBg localSurvey={localSurvey} handleBgChange={handleBgChange} />
      ) : tab === "animation" ? (
        <AnimatedSurveyBg localSurvey={localSurvey} handleBgChange={handleBgChange} />
      ) : (
        <ColorSurveyBg localSurvey={localSurvey} handleBgChange={handleBgChange} colours={colours} />
      )}
    </div>
  );
}
