"use client";

import { ChevronsLeftRight, ChevronsLeftRightEllipsis, ChevronsRightLeft } from "lucide-react";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TLinkSurveyCardWidthOptions } from "@formbricks/types/styling";
import { StylingTabs } from "@/modules/ui/components/styling-tabs";

interface CardWidthTabsProps {
  activeCardWidth: TLinkSurveyCardWidthOptions;
  setActiveCardWidth: (value: TLinkSurveyCardWidthOptions) => void;
  disabled?: boolean;
}

export const CardWidthTabs = ({
  activeCardWidth,
  setActiveCardWidth,
  disabled = false,
}: Readonly<CardWidthTabsProps>) => {
  const { t } = useTranslation();

  const handleCardWidthChange = (cardWidth: TLinkSurveyCardWidthOptions) => {
    if (disabled) return;
    setActiveCardWidth(cardWidth);
  };

  const getCardWidthIcon = (cardWidth: TLinkSurveyCardWidthOptions) => {
    const iconClassName = "size-4 text-slate-900";

    switch (cardWidth) {
      case "narrow":
        return <ChevronsRightLeft className={iconClassName} />;
      case "wide":
        return <ChevronsLeftRightEllipsis className={iconClassName} />;
      default:
        return <ChevronsLeftRight className={iconClassName} />;
    }
  };

  const options: {
    value: TLinkSurveyCardWidthOptions;
    label: string;
    icon: ReactNode;
  }[] = [
    {
      value: "narrow",
      label: t("workspace.surveys.edit.narrow"),
      icon: getCardWidthIcon("narrow"),
    },
    {
      value: "default",
      label: t("workspace.surveys.edit.default"),
      icon: getCardWidthIcon("default"),
    },
    {
      value: "wide",
      label: t("workspace.surveys.edit.wide"),
      icon: getCardWidthIcon("wide"),
    },
  ];

  return (
    <div className="w-full gap-2 rounded-md bg-white">
      <StylingTabs
        id="card-width"
        onChange={(value) => {
          handleCardWidthChange(value);
        }}
        options={options}
        defaultSelected={activeCardWidth}
        className="w-full"
        tabsContainerClassName="p-1 gap-2"
      />
    </div>
  );
};
