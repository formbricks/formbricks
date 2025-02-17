"use client";

import { AnimatedSurveyBg } from "@/modules/survey/editor/components/animated-survey-bg";
import { ColorSurveyBg } from "@/modules/survey/editor/components/color-survey-bg";
import { UploadImageSurveyBg } from "@/modules/survey/editor/components/image-survey-bg";
import { ImageFromUnsplashSurveyBg } from "@/modules/survey/editor/components/unsplash-images";
import { TabBar } from "@/modules/ui/components/tab-bar";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useTranslate } from "@tolgee/react";
import { useEffect, useState } from "react";

interface SurveyBgSelectorTabProps {
  handleBgChange: (bg: string, bgType: string) => void;
  colors: string[];
  bgType: string | null | undefined;
  environmentId: string;
  isUnsplashConfigured: boolean;
  bg: string;
}

export const SurveyBgSelectorTab = ({
  handleBgChange,
  colors,
  bgType,
  bg,
  environmentId,
  isUnsplashConfigured,
}: SurveyBgSelectorTabProps) => {
  const [activeTab, setActiveTab] = useState(bgType || "color");
  const { t } = useTranslate();
  const [parent] = useAutoAnimate();
  const [colorBackground, setColorBackground] = useState(bg);
  const [animationBackground, setAnimationBackground] = useState(bg);
  const [uploadBackground, setUploadBackground] = useState(bg);

  const tabs = [
    { id: "color", label: t("environments.surveys.edit.color") },
    { id: "animation", label: t("environments.surveys.edit.animation") },
    { id: "upload", label: t("environments.surveys.edit.upload") },
    { id: "image", label: t("environments.surveys.edit.image") },
  ];

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
      <div className="w-full rounded-b-lg border-x border-b border-slate-200 px-4 pb-4 pt-2" ref={parent}>
        {renderContent()}
      </div>
    </div>
  );
};
