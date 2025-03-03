"use client";

import { OptionsSwitch } from "@/modules/ui/components/options-switch";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { useState } from "react";

export const AppTab = ({ environmentId }) => {
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

      <div className="mt-4">
        {selectedTab === "webapp" ? <WebAppTab environmentId={environmentId} /> : <MobileAppTab />}
      </div>
    </div>
  );
};

const MobileAppTab = () => {
  const { t } = useTranslate();
  return (
    <div>
      <p className="text-lg font-semibold text-slate-800">
        {t("environments.surveys.summary.how_to_embed_a_survey_on_your_react_native_app")}
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>
          {t("common.follow_these")}{" "}
          <Link
            href="https://formbricks.com/docs/developer-docs/react-native-in-app-surveys"
            target="_blank"
            className="decoration-brand-dark font-medium underline underline-offset-2">
            {t("environments.surveys.summary.setup_instructions_for_react_native_apps")}
          </Link>{" "}
          {t("environments.surveys.summary.to_connect_your_app_with_formbricks")}
        </li>
      </ol>
      <div className="mt-2 text-sm italic text-slate-700">
        {t("environments.surveys.summary.were_working_on_sdks_for_flutter_swift_and_kotlin")}
      </div>
    </div>
  );
};

const WebAppTab = ({ environmentId }) => {
  const { t } = useTranslate();
  return (
    <div>
      <p className="text-lg font-semibold text-slate-800">
        {t("environments.surveys.summary.how_to_embed_a_survey_on_your_web_app")}
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>
          {t("common.follow_these")}{" "}
          <Link
            href={`/environments/${environmentId}/project/app-connection`}
            target="_blank"
            className="decoration-brand-dark font-medium underline underline-offset-2">
            {t("environments.surveys.summary.setup_instructions")}
          </Link>{" "}
          {t("environments.surveys.summary.to_connect_your_web_app_with_formbricks")}
        </li>
        <li>
          {t("environments.surveys.summary.learn_how_to")}{" "}
          <Link
            href="https://formbricks.com/docs/app-surveys/user-identification"
            target="_blank"
            className="decoration-brand-dark font-medium underline underline-offset-2">
            {t("environments.surveys.summary.identify_users_and_set_attributes")}
          </Link>{" "}
          {t("environments.surveys.summary.to_run_highly_targeted_surveys")}.
        </li>
        <li>
          {t("environments.surveys.summary.make_sure_the_survey_type_is_set_to")}{" "}
          <b>{t("common.app_survey")}</b>
        </li>
        <li>{t("environments.surveys.summary.define_when_and_where_the_survey_should_pop_up")}</li>
      </ol>
      <div className="mt-4">
        <video autoPlay loop muted className="w-full rounded-xl border border-slate-200">
          <source src="/video/tooltips/change-survey-type-app.mp4" type="video/mp4" />
          {t("environments.surveys.summary.unsupported_video_tag_warning")}
        </video>
      </div>
    </div>
  );
};
