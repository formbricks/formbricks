"use client";

import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";
import { useTranslate } from "@tolgee/react";
import { CopyIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";

export const WebsiteTab = ({ surveyUrl, environmentId }) => {
  const [selectedTab, setSelectedTab] = useState("static");
  const { t } = useTranslate();

  return (
    <div className="flex h-full grow flex-col">
      <OptionsSwitch
        options={[
          { value: "static", label: t("environments.surveys.summary.static_iframe") },
          { value: "popup", label: t("environments.surveys.summary.dynamic_popup") },
        ]}
        currentOption={selectedTab}
        handleOptionChange={(value) => setSelectedTab(value)}
      />

      <div className="mt-4">
        {selectedTab === "static" ? (
          <StaticTab surveyUrl={surveyUrl} />
        ) : (
          <PopupTab environmentId={environmentId} />
        )}
      </div>
    </div>
  );
};

const StaticTab = ({ surveyUrl }) => {
  const [embedModeEnabled, setEmbedModeEnabled] = useState(false);
  const { t } = useTranslate();
  const iframeCode = `<div style="position: relative; height:80dvh; overflow:auto;"> 
  <iframe 
    src="${surveyUrl}${embedModeEnabled ? "?embed=true" : ""}" 
    frameborder="0" style="position: absolute; left:0; top:0; width:100%; height:100%; border:0;">
  </iframe>
</div>`;

  return (
    <div className="flex h-full grow flex-col">
      <div className="flex justify-between">
        <div></div>
        <Button
          title="Embed survey in your website"
          aria-label="Embed survey in your website"
          onClick={() => {
            navigator.clipboard.writeText(iframeCode);
            toast.success(t("environments.surveys.summary.embed_code_copied_to_clipboard"));
          }}>
          {t("common.copy_code")}
          <CopyIcon />
        </Button>
      </div>
      <div className="prose prose-slate max-w-full">
        <CodeBlock
          customCodeClass="text-sm h-48 overflow-y-scroll text-sm"
          language="html"
          showCopyToClipboard={false}>
          {iframeCode}
        </CodeBlock>
      </div>
      <div className="mt-2 rounded-md border bg-white p-4">
        <AdvancedOptionToggle
          htmlId="enableEmbedMode"
          isChecked={embedModeEnabled}
          onToggle={setEmbedModeEnabled}
          title={t("environments.surveys.summary.embed_mode")}
          description={t("environments.surveys.summary.embed_mode_description")}
          childBorder={true}
        />
      </div>
    </div>
  );
};

const PopupTab = ({ environmentId }) => {
  const { t } = useTranslate();
  return (
    <div>
      <p className="text-lg font-semibold text-slate-800">
        {t("environments.surveys.summary.embed_pop_up_survey_title")}
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>
          {t("common.follow_these")}{" "}
          <Link
            href={`/environments/${environmentId}/project/website-connection`}
            target="_blank"
            className="decoration-brand-dark font-medium underline underline-offset-2">
            {t("environments.surveys.summary.setup_instructions")}
          </Link>{" "}
          {t("environments.surveys.summary.to_connect_your_website_with_formbricks")}
        </li>
        <li>
          {t("environments.surveys.summary.make_sure_the_survey_type_is_set_to")}{" "}
          <b>{t("common.website_survey")}</b>
        </li>
        <li>{t("environments.surveys.summary.define_when_and_where_the_survey_should_pop_up")}</li>
      </ol>
      <div className="mt-4">
        <video autoPlay loop muted className="w-full rounded-xl border border-slate-200">
          <source src="/video/tooltips/change-survey-type.mp4" type="video/mp4" />
          {t("environments.surveys.summary.unsupported_video_tag_warning")}
        </video>
      </div>
    </div>
  );
};
