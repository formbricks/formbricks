import { checkIsUnsplashApiPresent } from "@/app/s/[surveyId]/actions";
import { useEffect, useState } from "react";

import { TProductStyling } from "@formbricks/types/product";
import { TSurveyStyling } from "@formbricks/types/surveys";
import { TabBar } from "@formbricks/ui/TabBar";

import { AnimatedSurveyBg } from "./AnimatedSurveyBg";
import { ColorSurveyBg } from "./ColorSurveyBg";
import { ImageSurveyBg } from "./ImageSurveyBg";
import { UploadSurveyBg } from "./UploadSurveyBg";

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
  { id: "image", label: "Upload" },
  { id: "upload", label: "Image" },
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
  const [uploadBackground, setUploadBackground] = useState(background?.bg);
  const [isUnsplashApiPresent, setIsUnsplashApiPresent] = useState(false);

  useEffect(() => {
    const bgType = background?.bgType;

    if (bgType === "color") {
      setColorBackground(background?.bg);
      setAnimationBackground("");
      setImageBackground("");
      setUploadBackground("");
    }

    if (bgType === "animation") {
      setAnimationBackground(background?.bg);
      setColorBackground("");
      setImageBackground("");
      setUploadBackground("");
    }

    if (bgType === "image") {
      setImageBackground(background?.bg);
      setColorBackground("");
      setAnimationBackground("");
      setUploadBackground("");
    }

    if (bgType === "upload") {
      setUploadBackground(background?.bg);
      setColorBackground("");
      setAnimationBackground("");
      setImageBackground("");
    }

    checkIsUnsplashApiPresent().then((present) => {
      setIsUnsplashApiPresent(present);
    });
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
      case "upload":
        return <UploadSurveyBg handleBgChange={handleBgChange} background={uploadBackground ?? ""} />;
      default:
        return null;
    }
  };

  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-lg border bg-slate-50 p-4">
      <div className="flex w-full items-center justify-between overflow-hidden rounded-lg border border-slate-300">
        <TabBar
          tabs={tabs.filter((tab) => tab.id !== "upload" || isUnsplashApiPresent)}
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
