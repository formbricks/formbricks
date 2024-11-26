"use client";

import "prismjs/themes/prism.css";
import { useState } from "react";
import toast from "react-hot-toast";
import { TProductConfigChannel } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { CodeBlock } from "@formbricks/ui/CodeBlock";
import { TabBar } from "@formbricks/ui/TabBar";
import { Html5Icon, NpmIcon } from "@formbricks/ui/icons";

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
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const htmlSnippetForAppSurveys = `<!-- START Formbricks Surveys -->
  <script type="text/javascript">
  !function(){
      var apiHost = "${webAppUrl}";
      var environmentId = "${environmentId}";
      var userId = "testUser";
      var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src=apiHost+"/api/packages/app";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.init({environmentId: environmentId, apiHost: apiHost, userId: userId})},500)}();
  </script>
  <!-- END Formbricks Surveys -->
  `;

  const htmlSnippetForWebsiteSurveys = `<!-- START Formbricks Surveys -->
  <script type="text/javascript">
  !function(){
    var apiHost = "${webAppUrl}";
    var environmentId = "${environmentId}";
      var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src=apiHost+"/api/packages/website";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.init({environmentId: environmentId, apiHost: apiHost})},500)}();
  </script>
  <!-- END Formbricks Surveys -->
  `;

  const npmSnippetForAppSurveys = `
  import formbricks from "@formbricks/js/app";
  
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
  import formbricks from "@formbricks/js/website";
  
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
            <p>or</p>
            <CodeBlock customEditorClass="!bg-white border border-slate-200" language="sh">
              yarn add @formbricks/js
            </CodeBlock>
            <p className="text-sm text-slate-700">
              Import Formbricks and initialize the widget in your Component (e.g. App.tsx):
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
              Read docs
            </Button>
          </div>
        ) : activeTab === "html" ? (
          <div className="prose prose-slate">
            <p className="-mb-1 mt-6 text-sm text-slate-700">
              Insert this code into the &lt;head&gt; tag of your website:
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
                  toast.success("Copied to clipboard");
                }}>
                Copy code
              </Button>
              <Button
                id="onboarding-inapp-connect-step-by-step-manual"
                variant="secondary"
                href={`https://formbricks.com/docs/${channel}-surveys/framework-guides#html`}
                target="_blank">
                Step by step manual
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
