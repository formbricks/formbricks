"use client";

import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { useTranslate } from "@tolgee/react";
import { CopyIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface WebsiteEmbedTabProps {
  surveyUrl: string;
}

export const WebsiteEmbedTab = ({ surveyUrl }: WebsiteEmbedTabProps) => {
  const [embedModeEnabled, setEmbedModeEnabled] = useState(false);
  const { t } = useTranslate();

  const iframeCode = `<div style="position: relative; height:80dvh; overflow:auto;"> 
  <iframe 
    src="${surveyUrl}${embedModeEnabled ? "?embed=true" : ""}" 
    frameborder="0" style="position: absolute; left:0; top:0; width:100%; height:100%; border:0;">
  </iframe>
</div>`;

  return (
    <>
      <div className="prose prose-slate max-w-full">
        <CodeBlock
          customCodeClass="text-sm h-48 overflow-y-scroll"
          language="html"
          showCopyToClipboard={false}
          noMargin>
          {iframeCode}
        </CodeBlock>
      </div>
      <AdvancedOptionToggle
        htmlId="enableEmbedMode"
        isChecked={embedModeEnabled}
        onToggle={setEmbedModeEnabled}
        title={t("environments.surveys.summary.embed_mode")}
        description={t("environments.surveys.summary.embed_mode_description")}
        customContainerClass="p-0"
      />
      <Button
        title={t("common.copy_code")}
        aria-label={t("common.copy_code")}
        onClick={() => {
          navigator.clipboard.writeText(iframeCode);
          toast.success(t("environments.surveys.summary.embed_code_copied_to_clipboard"));
        }}>
        {t("common.copy_code")}
        <CopyIcon />
      </Button>
    </>
  );
};
