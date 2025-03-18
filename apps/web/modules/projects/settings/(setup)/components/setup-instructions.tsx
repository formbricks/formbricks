"use client";

import { CodeBlock } from "@/modules/ui/components/code-block";
import { Html5Icon, NpmIcon } from "@/modules/ui/components/icons";
import { TabBar } from "@/modules/ui/components/tab-bar";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import "prismjs/themes/prism.css";
import { useState } from "react";

const tabs = [
  {
    id: "npm",
    label: "NPM",
    icon: <NpmIcon />,
  },
  { id: "html", label: "HTML", icon: <Html5Icon /> },
];

interface SetupInstructionsProps {
  environmentId: string;
  webAppUrl: string;
}

export const SetupInstructions = ({ environmentId, webAppUrl }: SetupInstructionsProps) => {
  const { t } = useTranslate();
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  return (
    <div>
      <TabBar tabs={tabs} activeId={activeTab} setActiveId={setActiveTab} />
      <div className="px-6 py-5">
        {activeTab === "npm" ? (
          <div className="prose prose-slate prose-p:my-2 prose-p:text-sm prose-p:text-slate-600 prose-h4:text-slate-800 prose-h4:pt-2">
            <h4>{t("environments.project.app-connection.step_1")}</h4>
            <CodeBlock language="sh">pnpm install @formbricks/js</CodeBlock>
            <p>or</p>
            <CodeBlock language="sh">npm install @formbricks/js</CodeBlock>
            <p>or</p>
            <CodeBlock language="sh">yarn add @formbricks/js</CodeBlock>
            <h4>{t("environments.project.app-connection.step_2")}</h4>
            <p>{t("environments.project.app-connection.step_2_description")}</p>
            <CodeBlock language="js">{`import formbricks from "@formbricks/js";
if (typeof window !== "undefined") {
  formbricks.init({
    environmentId: "${environmentId}", 
    apiHost: "${webAppUrl}",
  });
}`}</CodeBlock>
            <ul className="list-disc text-sm">
              <li>
                <span className="font-semibold">environmentId :</span>{" "}
                {t("environments.project.app-connection.environment_id_description_with_environment_id", {
                  environmentId: environmentId,
                })}
              </li>
              <li>
                <span className="font-semibold">apiHost:</span>{" "}
                {t("environments.project.app-connection.api_host_description")}
              </li>
            </ul>
            <span className="text-sm text-slate-600">
              {t("environments.project.app-connection.if_you_are_planning_to")}
              <Link
                href="https://formbricks.com//docs/app-surveys/user-identification"
                target="blank"
                className="underline">
                {t("environments.project.app-connection.identifying_your_users")}
              </Link>{" "}
              {t("environments.project.app-connection.you_also_need_to_pass_a")}{" "}
              <span className="font-semibold">userId</span> {t("environments.project.app-connection.to_the")}{" "}
              <span className="font-semibold">init</span> {t("environments.project.app-connection.function")}.
            </span>
            <h4>{t("environments.project.app-connection.step_3")}</h4>
            <p>
              {t("environments.project.app-connection.switch_on_the_debug_mode_by_appending")}{" "}
              <i>?formbricksDebug=true</i>{" "}
              {t("environments.project.app-connection.to_the_url_where_you_load_the")}{" "}
              {t("environments.project.app-connection.formbricks_sdk")}.{" "}
              {t("environments.project.app-connection.open_the_browser_console_to_see_the_logs")}{" "}
              <Link
                className="decoration-brand-dark"
                href="https://formbricks.com/docs/developer-docs/js-sdk#debug-mode"
                target="_blank">
                {t("common.read_docs")}
              </Link>{" "}
            </p>
            <h4>{t("environments.project.app-connection.you_are_done")}</h4>
            <p>{t("environments.project.app-connection.your_app_now_communicates_with_formbricks")}</p>
            <ul className="list-disc text-sm text-slate-700">
              <li>
                <span>{t("environments.project.app-connection.need_a_more_detailed_setup_guide_for")}</span>{" "}
                <Link
                  className="decoration-brand-dark"
                  href="https://formbricks.com/docs/website-surveys/quickstart"
                  target="_blank">
                  {t("environments.project.app-connection.check_out_the_docs")}
                </Link>
              </li>
              <li>
                <span>{t("environments.project.app-connection.not_working")}</span>{" "}
                <Link
                  className="decoration-brand-dark"
                  target="_blank"
                  href="https://github.com/formbricks/formbricks/issues">
                  {t("environments.project.app-connection.open_an_issue_on_github")}
                </Link>{" "}
              </li>
              <li>
                <span>
                  {t("environments.project.app-connection.want_to_learn_how_to_add_user_attributes")}
                </span>{" "}
                <Link
                  className="decoration-brand-dark"
                  href="https://formbricks.com/docs/attributes/why"
                  target="_blank">
                  {t("environments.project.app-connection.dive_into_the_docs")}
                </Link>
              </li>
            </ul>
          </div>
        ) : activeTab === "html" ? (
          <div className="prose prose-slate prose-p:my-2 prose-p:text-sm prose-p:text-slate-600 prose-h4:text-slate-800 prose-h4:pt-2">
            <h4>{t("environments.project.app-connection.step_1")}</h4>
            <p>
              {t("environments.project.app-connection.insert_this_code_into_the")} <code>{`<head>`}</code>{" "}
              {t("environments.project.app-connection.tag_of_your_app")}
            </p>
            <CodeBlock language="js">{`<!-- START Formbricks Surveys -->
<script type="text/javascript">
!function(){var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src="${webAppUrl}/js/formbricks.umd.cjs",t.onload=function(){window.formbricks?window.formbricks.init({environmentId:"${environmentId}",apiHost:"${window.location.protocol}//${window.location.host}"}):console.error("Formbricks library failed to load properly. The formbricks object is not available.");};var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e)}();
</script>
<!-- END Formbricks Surveys -->`}</CodeBlock>
            <h4>Step 2: Debug mode</h4>
            <p>
              {t("environments.project.app-connection.switch_on_the_debug_mode_by_appending")}{" "}
              <i>{`?formbricksDebug=true`}</i>{" "}
              {t("environments.project.app-connection.to_the_url_where_you_load_the")}{" "}
              {t("environments.project.app-connection.formbricks_sdk")}.{" "}
              {t("environments.project.app-connection.open_the_browser_console_to_see_the_logs")}{" "}
              <Link
                className="decoration-brand-dark"
                href="https://formbricks.com/docs/developer-docs/js-sdk#debug-mode"
                target="_blank">
                {t("common.read_docs")}
              </Link>{" "}
            </p>
            <h4>{t("environments.project.app-connection.you_are_done")}</h4>
            <p>{t("environments.project.app-connection.your_app_now_communicates_with_formbricks")}</p>
            <ul className="list-disc text-sm text-slate-700">
              <li>
                <span className="font-semibold">
                  {t("environments.project.app-connection.does_your_widget_work")}
                </span>
                <span>{t("environments.project.app-connection.scroll_to_the_top")}</span>
              </li>
              <li>
                <span className="font-semibold">
                  {t("environments.project.app-connection.have_a_problem")}
                </span>{" "}
                <Link
                  className="decoration-brand-dark"
                  target="_blank"
                  href="https://github.com/formbricks/formbricks/issues">
                  {t("environments.project.app-connection.open_an_issue_on_github")}
                </Link>{" "}
              </li>
              <li>
                <span className="font-semibold">
                  {t("environments.project.app-connection.want_to_learn_how_to_add_user_attributes")}
                </span>{" "}
                <Link
                  className="decoration-brand-dark"
                  href="https://formbricks.com/docs/attributes/why"
                  target="_blank">
                  {t("environments.project.app-connection.dive_into_the_docs")}
                </Link>
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
};
