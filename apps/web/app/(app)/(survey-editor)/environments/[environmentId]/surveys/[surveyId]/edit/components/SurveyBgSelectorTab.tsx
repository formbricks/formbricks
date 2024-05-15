import { useEffect, useState } from "react";

import { TProductStyling } from "@formbricks/types/product";
import { TSurveyStyling } from "@formbricks/types/surveys";
import { TabBar } from "@formbricks/ui/TabBar";

import { AnimatedSurveyBg } from "./AnimatedSurveyBg";
import { ColorSurveyBg } from "./ColorSurveyBg";
import { UploadImageSurveyBg } from "./ImageSurveyBg";
import { ImageFromUnsplashSurveyBg } from "./UnsplashImages";

interface SurveyBgSelectorTabProps {
  handleBgChange: (bg: string, bgType: string) => void;
  colors: string[];
  bgType: string | null | undefined;
  environmentId: string;
  styling: TSurveyStyling | TProductStyling | null;
  isUnsplashConfigured: boolean;
}

const tabs = [
  { id: "color", label: "Color" },
  { id: "animation", label: "Animation" },
  { id: "upload", label: "Upload" },
  { id: "image", label: "Image" },
];

export const SurveyBgSelectorTab = ({
  styling,
  handleBgChange,
  colors,
  bgType,
  environmentId,
  isUnsplashConfigured,
}: SurveyBgSelectorTabProps) => {
  const [activeTab, setActiveTab] = useState(bgType || "color");
  const bgUrl = styling?.background?.bg || "";

  const [colorBackground, setColorBackground] = useState(bgUrl);
  const [animationBackground, setAnimationBackground] = useState(bgUrl);
  const [uploadBackground, setUploadBackground] = useState(bgUrl);

  useEffect(() => {
    if (bgType === "color") {
      setColorBackground(bgUrl);
      setAnimationBackground("");
      setUploadBackground("");
    }

    if (bgType === "animation") {
      setAnimationBackground(bgUrl);
      setColorBackground("");
      setUploadBackground("");
    }

    if (isUnsplashConfigured && bgType === "image") {
      setColorBackground("");
      setAnimationBackground("");
      setUploadBackground("");
    }

    if (bgType === "upload") {
      setUploadBackground(bgUrl);
      setColorBackground("");
      setAnimationBackground("");
    }
  }, [bgUrl, bgType, isUnsplashConfigured]);

  const renderContent = () => {
    switch (activeTab) {
      case "color":
        return <ColorSurveyBg handleBgChange={handleBgChange} colors={colors} background={colorBackground} />;
      case "animation":
        return <AnimatedSurveyBg handleBgChange={handleBgChange} background={animationBackground} />;
      case "upload":
        return (
          <UploadImageSurveyBg
            environmentId={environmentId}
            handleBgChange={handleBgChange}
            background={uploadBackground}
          />
        );
      case "image":
        if (isUnsplashConfigured) {
          return <ImageFromUnsplashSurveyBg handleBgChange={handleBgChange} />;
        }
      default:
        return null;
    }
  };

  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-lg ">
      <TabBar
        tabs={tabs.filter((tab) => tab.id !== "image" || isUnsplashConfigured)}
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
};
