"use client";

import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { useState } from "react";

export const AppTab = ({}) => {
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

const MobileAppTab = () => {
  const { t } = useTranslate();
  return (
    <Alert>
      <AlertTitle>{t("environments.surveys.summary.quickstart_mobile_apps")}</AlertTitle>
      <AlertDescription>
        {t("environments.surveys.summary.quickstart_mobile_apps_description")}
        <Button asChild className="w-fit" size="sm" variant="link">
          <Link
            href="https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/framework-guides"
            target="_blank">
            {t("common.learn_more")}
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
};

const WebAppTab = ({}) => {
  const { t } = useTranslate();
  return (
    <Alert>
      <AlertTitle>{t("environments.surveys.summary.quickstart_web_apps")}</AlertTitle>
      <AlertDescription>
        {t("environments.surveys.summary.quickstart_web_apps_description")}
        <Button asChild className="w-fit" size="sm" variant="link">
          <Link
            href="https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/quickstart"
            target="_blank">
            {t("common.learn_more")}
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
};
