import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { useTranslate } from "@tolgee/react";
import React from "react";

export default function YourClientPage() {
  const handleLearnMore = () => {
    alert("Learn more");
  };

  // Inside your component function
  const { t } = useTranslate();

  return (
    <div>
      <Alert variant="warning" size="small" className="w-fit">
        <AlertTitle>Inconsistent Response Data</AlertTitle>
        <AlertButton onClick={() => handleLearnMore()}>{t("common.learn_more")}</AlertButton>
      </Alert>
    </div>
  );
}
