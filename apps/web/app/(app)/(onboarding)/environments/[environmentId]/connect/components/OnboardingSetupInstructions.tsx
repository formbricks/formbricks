"use client";

import { useTranslations } from "next-intl";
import "prismjs/themes/prism.css";
import { useState } from "react";
import toast from "react-hot-toast";
import { TProductConfigChannel } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/components/Button";
import { CodeBlock } from "@formbricks/ui/components/CodeBlock";
import { TabBar } from "@formbricks/ui/components/TabBar";
import { Html5Icon, NpmIcon } from "@formbricks/ui/components/icons";

const tabs = [
  { id: "html", label: "HTML", icon: <Html5Icon /> },
  { id: "npm", label: "NPM", icon: <NpmIcon /> },
];

interface OnboardingSetupInstructionsProps {
  environmentId: string;
  webAppUrl: string;
  channel: TProductConfigChannel;
  widgetSetupCompleted: boolean;
}

export const OnboardingSetupInstructions = ({
  environmentId,
  webAppUrl,
  channel,
  widgetSetupCompleted,
}: OnboardingSetupInstructionsProps) => {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const htmlSnippetForAppSurveys = `<!-- START Formbricks Surveys -->
  <script type="text/javascript">
  !function(){
      var apiHost = "${webAppUrl}";
      var environmentId = "${environmentId}";
      var userId = "testUser";
      var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src=apiHost+"/js/formbricks.umd.cjs";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.init({environmentId: environmentId, apiHost: apiHost, userId: userId})},500)}();
  </script>
  <!-- END Formbricks Surveys -->
  `;

  const htmlSnippetForWebsiteSurveys = `<!-- START Formbricks Surveys -->
  <script type="text/javascript">
  !function(){
    var apiHost = "${webAppUrl}";
    var environmentId = "${environmentId}";
      var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src=apiHost+"/js/formbricks.umd.cjs";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.init({environmentId: environmentId, apiHost: apiHost})},500)}();
  </script>
  <!-- END Formbricks Surveys -->
  `;

  const npmSnippetForAppSurveys = `
  import formbricks from "@formbricks/js";
  
  if (typeof window !== "undefined") {
    formbricks.init({
      environmentId: "${environmentId}",
      apiHost: "${webAppUrl}",
      userId: "testUser",
    });
  }
  
  function App() {
    // your own app
  }
  
  export default App;
  `;

  const npmSnippetForWebsiteSurveys = `
  // other imports
  import formbricks from "@formbricks/js";
  
  if (typeof window !== "undefined") {
    formbricks.init({
      environmentId: "${environmentId}",
      apiHost: "${webAppUrl}",
    });
  }
  
  function App() {
    // your own app
  }
  
  export default App;
  
  `;

  return (
    <div>
      <div className="flex h-14 w-full items-center justify-center rounded-md border border-slate-200 bg-white">
        <TabBar
          tabs={tabs}
          activeId={activeTab}
          setActiveId={setActiveTab}
          tabStyle="button"
          className="bg-slate-100"
        />
      </div>
      <div>
        {activeTab === "npm" ? (
          <div className="prose prose-slate w-full">
            <CodeBlock customEditorClass="!bg-white border border-slate-200" language="sh">
              npm install @formbricks/js
            </CodeBlock>
            <p>{t("common.or")}</p>
            <CodeBlock customEditorClass="!bg-white border border-slate-200" language="sh">
              yarn add @formbricks/js
            </CodeBlock>
            <p className="text-sm text-slate-700">
              {t("environments.connect.import_formbricks_and_initialize_the_widget_in_your_component")}
            </p>
            <CodeBlock customEditorClass="!bg-white border border-slate-200" language="js">
              {channel === "app" ? npmSnippetForAppSurveys : npmSnippetForWebsiteSurveys}
            </CodeBlock>
            <Button
              id="onboarding-inapp-connect-read-npm-docs"
              className="mt-3"
              variant="secondary"
              href={`https://formbricks.com/docs/${channel}-surveys/framework-guides`}
              target="_blank">
              {t("common.read_docs")}
            </Button>
          </div>
        ) : activeTab === "html" ? (
          <div className="prose prose-slate">
            <p className="-mb-1 mt-6 text-sm text-slate-700">
              {t("environments.connect.insert_this_code_into_the_head_tag_of_your_website")}
            </p>
            <div>
              <CodeBlock customEditorClass="!bg-white border border-slate-200" language="js">
                {channel === "app" ? htmlSnippetForAppSurveys : htmlSnippetForWebsiteSurveys}
              </CodeBlock>
            </div>

            <div className="mt-4 flex justify-between space-x-2">
              <Button
                id="onboarding-inapp-connect-copy-code"
                variant={widgetSetupCompleted ? "secondary" : "primary"}
                onClick={() => {
                  navigator.clipboard.writeText(
                    channel === "app" ? htmlSnippetForAppSurveys : htmlSnippetForWebsiteSurveys
                  );
                  toast.success(t("common.copied_to_clipboard"));
                }}>
                {t("common.copy_code")}
              </Button>
              <Button
                id="onboarding-inapp-connect-step-by-step-manual"
                variant="secondary"
                href={`https://formbricks.com/docs/${channel}-surveys/framework-guides#html`}
                target="_blank">
                {t("common.step_by_step_manual")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
