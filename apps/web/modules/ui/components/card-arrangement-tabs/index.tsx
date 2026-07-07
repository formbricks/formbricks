"use client";

import { SquareDashedTopSolid } from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TCardArrangementOptions } from "@formbricks/types/styling";
import { TSurveyType } from "@formbricks/types/surveys/types";
import { CasualCardArrangementIcon } from "@/modules/ui/components/icons/casual-card-arrangement-icon";
import { SimpleCardsArrangementIcon } from "@/modules/ui/components/icons/simple-card-arrangement-icon";
import { StraightCardArrangementIcon } from "@/modules/ui/components/icons/straight-card-arrangement-icon";
import { StylingTabs } from "@/modules/ui/components/styling-tabs";

interface CardArrangementTabsProps {
  surveyType: TSurveyType;
  activeCardArrangement: TCardArrangementOptions;
  setActiveCardArrangement: (arrangement: TCardArrangementOptions, surveyType: TSurveyType) => void;
  disabled?: boolean;
}

export const CardArrangementTabs = ({
  activeCardArrangement,
  surveyType,
  setActiveCardArrangement,
  disabled = false,
}: CardArrangementTabsProps) => {
  const { t } = useTranslation();
  const handleCardArrangementChange = (arrangement: TCardArrangementOptions) => {
    if (disabled) return;
    setActiveCardArrangement(arrangement, surveyType);
  };

  const getCardArrangementIcon = (cardArrangement: string) => {
    switch (cardArrangement) {
      case "casual":
        return <CasualCardArrangementIcon />;
      case "straight":
        return <StraightCardArrangementIcon />;
      case "cardless":
        return <SquareDashedTopSolid className="size-4 text-slate-900" />;
      default:
        return <SimpleCardsArrangementIcon />;
    }
  };

  const options: {
    value: TCardArrangementOptions;
    label: string;
    icon: ReactNode;
  }[] = [
    {
      value: "simple",
      label: t("workspace.surveys.edit.simple"),
      icon: getCardArrangementIcon("simple"),
    },
    {
      value: "straight",
      label: t("workspace.surveys.edit.straight"),
      icon: getCardArrangementIcon("straight"),
    },
    {
      value: "casual",
      label: t("workspace.surveys.edit.casual"),
      icon: getCardArrangementIcon("casual"),
    },
  ];

  if (surveyType === "link") {
    options.push({
      value: "cardless",
      label: t("workspace.surveys.edit.cardless"),
      icon: getCardArrangementIcon("cardless"),
    });
  }

  return (
    <div className="w-full gap-2 rounded-md bg-white">
      <StylingTabs
        id="card-arrangement"
        onChange={(value) => {
          handleCardArrangementChange(value);
        }}
        options={options}
        defaultSelected={activeCardArrangement}
        className="w-full"
        tabsContainerClassName="p-1 gap-2"
      />
    </div>
  );
};
