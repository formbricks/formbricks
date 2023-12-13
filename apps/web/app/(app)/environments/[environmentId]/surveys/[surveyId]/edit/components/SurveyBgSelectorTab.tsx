import { TSurvey } from "@formbricks/types/surveys";
import { useState } from "react";
import AnimatedSurveyBg from "./AnimatedSurveyBg";
import ColorSurveyBg from "./ColorSurveyBg";
import ImageSurveyBg from "./ImageSurveyBg";

interface SurveyBgSelectorTabProps {
  localSurvey: TSurvey;
  handleBgChange: (bg: string, bgType: string) => void;
  colours: string[];
  bgType: string | null | undefined;
}

const TabButton = ({ isActive, onClick, children }) => (
  <button
    className={`w-1/4 rounded-md p-2 text-sm font-medium leading-none text-slate-800 ${
      isActive ? "bg-white shadow-sm" : ""
    }`}
    onClick={onClick}>
    {children}
  </button>
);

export default function SurveyBgSelectorTab({
  localSurvey,
  handleBgChange,
  colours,
  bgType,
}: SurveyBgSelectorTabProps) {
  const [tab, setTab] = useState(bgType || "image");

  const renderContent = () => {
    switch (tab) {
      case "image":
        return <ImageSurveyBg localSurvey={localSurvey} handleBgChange={handleBgChange} />;
      case "animation":
        return <AnimatedSurveyBg localSurvey={localSurvey} handleBgChange={handleBgChange} />;
      case "color":
        return <ColorSurveyBg localSurvey={localSurvey} handleBgChange={handleBgChange} colours={colours} />;
      default:
        return null;
    }
  };

  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-lg border bg-slate-50 p-4 px-8">
      <div className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-6 py-1.5">
        <TabButton isActive={tab === "image"} onClick={() => setTab("image")}>
          Image
        </TabButton>
        <TabButton isActive={tab === "animation"} onClick={() => setTab("animation")}>
          Animation
        </TabButton>
        <TabButton isActive={tab === "color"} onClick={() => setTab("color")}>
          Color
        </TabButton>
      </div>
      {renderContent()}
    </div>
  );
}
