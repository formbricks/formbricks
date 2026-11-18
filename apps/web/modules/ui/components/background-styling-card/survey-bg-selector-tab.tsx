"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatedSurveyBg } from "@/modules/survey/editor/components/animated-survey-bg";
import { ColorSurveyBg } from "@/modules/survey/editor/components/color-survey-bg";
import { UploadImageSurveyBg } from "@/modules/survey/editor/components/image-survey-bg";
import { ImageFromUnsplashSurveyBg } from "@/modules/survey/editor/components/unsplash-images";
import { TabBar } from "@/modules/ui/components/tab-bar";

interface SurveyBgSelectorTabProps {
  readonly handleBgChange: (bg: string, bgType: string) => void;
  readonly colors: string[];
  readonly bgType: string | null | undefined;
  readonly workspaceId: string;
  readonly isUnsplashConfigured: boolean;
  readonly bg: string;
  readonly isStorageConfigured: boolean;
}

export const SurveyBgSelectorTab = ({
  handleBgChange,
  colors,
  bgType,
  bg,
  workspaceId,
  isUnsplashConfigured,
  isStorageConfigured = true,
}: SurveyBgSelectorTabProps) => {
  const [activeTab, setActiveTab] = useState(bgType || "color");
  const { t } = useTranslation();
  const [parent] = useAutoAnimate();
  const [colorBackground, setColorBackground] = useState(bg);
  const [animationBackground, setAnimationBackground] = useState(bg);
  const [uploadBackground, setUploadBackground] = useState(bg);

  const tabs = [
    { id: "color", label: t("workspace.surveys.edit.color") },
    { id: "animation", label: t("workspace.surveys.edit.animation") },
    { id: "upload", label: t("workspace.surveys.edit.upload") },
    { id: "image", label: t("workspace.surveys.edit.image") },
  ];

  // Each tab keeps only the background of the active type. Adjusted during render, from the first.
  const [syncedFrom, setSyncedFrom] = useState<{
    bg: typeof bg;
    bgType: typeof bgType;
    isUnsplashConfigured: typeof isUnsplashConfigured;
  } | null>(null);
  if (
    syncedFrom?.bg !== bg ||
    syncedFrom.bgType !== bgType ||
    syncedFrom.isUnsplashConfigured !== isUnsplashConfigured
  ) {
    setSyncedFrom({ bg, bgType, isUnsplashConfigured });
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
  }

  const renderContent = () => {
    switch (activeTab) {
      case "color":
        return <ColorSurveyBg handleBgChange={handleBgChange} colors={colors} background={colorBackground} />;
      case "animation":
        return <AnimatedSurveyBg handleBgChange={handleBgChange} background={animationBackground} />;
      case "upload":
        return (
          <UploadImageSurveyBg
            workspaceId={workspaceId}
            handleBgChange={handleBgChange}
            background={uploadBackground}
            isStorageConfigured={isStorageConfigured}
          />
        );
      case "image":
        if (isUnsplashConfigured) {
          return <ImageFromUnsplashSurveyBg handleBgChange={handleBgChange} />;
        }
        return null;
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
      <div className="w-full rounded-b-lg border-x border-b border-slate-200 px-4 pt-2 pb-4" ref={parent}>
        {renderContent()}
      </div>
    </div>
  );
};
