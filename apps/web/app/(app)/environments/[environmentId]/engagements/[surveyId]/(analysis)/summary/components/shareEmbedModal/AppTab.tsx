"use client";

import { MobileAppTab } from "@/app/(app)/environments/[environmentId]/engagements/[surveyId]/(analysis)/summary/components/shareEmbedModal/MobileAppTab";
import { WebAppTab } from "@/app/(app)/environments/[environmentId]/engagements/[surveyId]/(analysis)/summary/components/shareEmbedModal/WebAppTab";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";

export const AppTab = () => {
  const { t } = useTranslate();
  const [selectedTab, setSelectedTab] = useState("webapp");

  return (
    <div className="flex h-full grow flex-col">
      <OptionsSwitch
        options={[
          { value: "webapp", label: t("environments.surveys.summary.web_app") },
          { value: "mobile", label: t("environments.surveys.summary.mobile_app") },
        ]}
        currentOption={selectedTab}
        handleOptionChange={(value) => setSelectedTab(value)}
      />

      <div className="mt-4">{selectedTab === "webapp" ? <WebAppTab /> : <MobileAppTab />}</div>
    </div>
  );
};
