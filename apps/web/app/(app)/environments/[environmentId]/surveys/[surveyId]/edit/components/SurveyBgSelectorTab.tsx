import { useEffect, useState } from "react";

import { TProductStyling } from "@formbricks/types/product";
import { TSurveyStyling } from "@formbricks/types/surveys";
import { TabBar } from "@formbricks/ui/TabBar";

import { AnimatedSurveyBg } from "./AnimatedSurveyBg";
import { ColorSurveyBg } from "./ColorSurveyBg";
import { ImageSurveyBg } from "./ImageSurveyBg";

interface SurveyBgSelectorTabProps {
  handleBgChange: (bg: string, bgType: string) => void;
  colors: string[];
  bgType: string | null | undefined;
  environmentId: string;
  styling: TSurveyStyling | TProductStyling | null;
}

const tabs = [
  { id: "color", label: "Color" },
  { id: "animation", label: "Animation" },
  { id: "image", label: "Image" },
];

export default function SurveyBgSelectorTab({
  styling,
  handleBgChange,
  colors,
  bgType,
  environmentId,
}: SurveyBgSelectorTabProps) {
  const [activeTab, setActiveTab] = useState(bgType || "color");
  const { background } = styling ?? {};

  const [colorBackground, setColorBackground] = useState(background?.bg);
  const [animationBackground, setAnimationBackground] = useState(background?.bg);
  const [imageBackground, setImageBackground] = useState(background?.bg);

  useEffect(() => {
    const bgType = background?.bgType;

    if (bgType === "color") {
      setColorBackground(background?.bg);
      setAnimationBackground("");
      setImageBackground("");
    }

    if (bgType === "animation") {
      setAnimationBackground(background?.bg);
      setColorBackground("");
      setImageBackground("");
    }

    if (bgType === "image") {
      setImageBackground(background?.bg);
      setColorBackground("");
      setAnimationBackground("");
    }
  }, [background?.bg, background?.bgType]);

  const renderContent = () => {
    switch (activeTab) {
      case "color":
        return (
          <ColorSurveyBg handleBgChange={handleBgChange} colors={colors} background={colorBackground ?? ""} />
        );
      case "animation":
        return <AnimatedSurveyBg handleBgChange={handleBgChange} background={animationBackground ?? ""} />;
      case "image":
        return (
          <ImageSurveyBg
            environmentId={environmentId}
            handleBgChange={handleBgChange}
            background={imageBackground ?? ""}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-lg ">
      <TabBar
        tabs={tabs}
        activeId={activeTab}
        setActiveId={setActiveTab}
        tabStyle="button"
        className="bg-slate-100"
      />
      <div className="w-full rounded-b-lg border-x border-b border-slate-200 px-4 pb-4 pt-2">
        {renderContent()}
      </div>
    </div>
  );
}
