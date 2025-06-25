"use client";

import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";

export const WebAppTab = () => {
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
