import { useEffect, useState } from "react";

import { TProductStyling } from "@formbricks/types/product";
import { TSurveyStyling } from "@formbricks/types/surveys";
import { TabBar } from "@formbricks/ui/TabBar";

import { AnimatedSurveyBg } from "./AnimatedSurveyBg";
import { ColorSurveyBg } from "./ColorSurveyBg";
import { UploadImageSurveyBg } from "./ImageSurveyBg";
import { ImageFromThirdPartySurveyBg } from "./UploadSurveyBg";

interface SurveyBgSelectorTabProps {
  handleBgChange: (bg: string, bgType: string) => void;
  colors: string[];
  bgType: string | null | undefined;
  environmentId: string;
  styling: TSurveyStyling | TProductStyling | null;
  unsplashApiKey?: string;
}

const tabs = [
  { id: "color", label: "Color" },
  { id: "animation", label: "Animation" },
  { id: "upload", label: "Upload" },
  { id: "image", label: "Image" },
];

export default function SurveyBgSelectorTab({
  styling,
  handleBgChange,
  colors,
  bgType,
  environmentId,
  unsplashApiKey,
}: SurveyBgSelectorTabProps) {
  const [activeTab, setActiveTab] = useState(bgType || "color");
  const { background } = styling ?? {};

  const [colorBackground, setColorBackground] = useState(background?.bg);
  const [animationBackground, setAnimationBackground] = useState(background?.bg);
  const [uploadBackground, setUploadBackground] = useState(background?.bg);

  useEffect(() => {
    const bgType = background?.bgType;
    console.log("bgType?", bgType);

    if (bgType === "color") {
      setColorBackground(background?.bg);
      setAnimationBackground("");
      setUploadBackground("");
    }

    if (bgType === "animation") {
      setAnimationBackground(background?.bg);
      setColorBackground("");
      setUploadBackground("");
    }

    if (bgType === "upload") {
      setColorBackground("");
      setAnimationBackground("");
      setUploadBackground("");
    }

    if (bgType === "image") {
      setUploadBackground(background?.bg);
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
      case "upload":
        return (
          <UploadImageSurveyBg
            environmentId={environmentId}
            handleBgChange={handleBgChange}
            background={uploadBackground ?? ""}
          />
        );
      case "image":
        return <ImageFromThirdPartySurveyBg environmentId={environmentId} handleBgChange={handleBgChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-lg border bg-slate-50 p-4">
      <div className="flex w-full items-center justify-between overflow-hidden rounded-lg border border-slate-300">
        <TabBar
          tabs={tabs.filter((tab) => tab.id !== "upload" || unsplashApiKey)}
          activeId={activeTab}
          setActiveId={setActiveTab}
          tabStyle="button"
          className="bg-slate-100"
        />
      </div>
      {renderContent()}
    </div>
  );
}
