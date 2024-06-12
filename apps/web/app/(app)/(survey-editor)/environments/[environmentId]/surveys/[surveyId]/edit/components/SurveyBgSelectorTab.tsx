import { useEffect, useState } from "react";
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
  isUnsplashConfigured: boolean;
  bg: string;
}

const tabs = [
  { id: "color", label: "Color" },
  { id: "animation", label: "Animation" },
  { id: "upload", label: "Upload" },
  { id: "image", label: "Image" },
];

export const SurveyBgSelectorTab = ({
  handleBgChange,
  colors,
  bgType,
  bg,
  environmentId,
  isUnsplashConfigured,
}: SurveyBgSelectorTabProps) => {
  const [activeTab, setActiveTab] = useState(bgType || "color");

  const [colorBackground, setColorBackground] = useState(bg);
  const [animationBackground, setAnimationBackground] = useState(bg);
  const [uploadBackground, setUploadBackground] = useState(bg);

  useEffect(() => {
    if (bgType === "color") {
      setColorBackground(bg);
      setAnimationBackground("");
      setUploadBackground("");
    }

    if (bgType === "animation") {
      setAnimationBackground(bg);
      setColorBackground("");
      setUploadBackground("");
    }

    if (isUnsplashConfigured && bgType === "image") {
      setColorBackground("");
      setAnimationBackground("");
      setUploadBackground("");
    }

    if (bgType === "upload") {
      setUploadBackground(bg);
      setColorBackground("");
      setAnimationBackground("");
    }
  }, [bg, bgType, isUnsplashConfigured]);

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
    <div className="mt-4 flex flex-col items-center justify-center rounded-lg">
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
