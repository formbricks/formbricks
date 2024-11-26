"use client";

import Link from "next/link";
import "prismjs/themes/prism.css";
import { useState } from "react";
import { CodeBlock } from "@formbricks/ui/CodeBlock";
import { TabBar } from "@formbricks/ui/TabBar";
import { Html5Icon, NpmIcon } from "@formbricks/ui/icons";

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
  type: "app" | "website";
}

export const SetupInstructions = ({ environmentId, webAppUrl, type }: SetupInstructionsProps) => {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  return (
    <div>
      <TabBar tabs={tabs} activeId={activeTab} setActiveId={setActiveTab} />
      <div className="px-6 py-5">
        {activeTab === "npm" ? (
          <div className="prose prose-slate prose-p:my-2 prose-p:text-sm prose-p:text-slate-600 prose-h4:text-slate-800 prose-h4:pt-2">
            <h4>Step 1: Install with pnpm, npm or yarn</h4>
            <CodeBlock language="sh">pnpm install @formbricks/js</CodeBlock>
            <p>or</p>
            <CodeBlock language="sh">npm install @formbricks/js</CodeBlock>
            <p>or</p>
            <CodeBlock language="sh">yarn add @formbricks/js</CodeBlock>
            <h4>Step 2: Initialize widget</h4>
            <p>Import Formbricks and initialize the widget in your Component (e.g. App.tsx):</p>
            <CodeBlock language="js">{`import formbricks from "@formbricks/js/${type}";
if (typeof window !== "undefined") {
  formbricks.init({
    environmentId: "${environmentId}", ${type === "app" ? `\n    userId: "<user-id>",` : ""}
    apiHost: "${webAppUrl}",
  });
}`}</CodeBlock>

            <ul className="list-disc text-sm">
              <li>
                <span className="font-semibold">environmentId:</span> Used to identify the correct
                environment: {environmentId} is yours.
              </li>
              <li>
                <span className="font-semibold">apiHost:</span> This is the URL of your Formbricks backend.
              </li>
            </ul>
            <h4>Step 3: Debug mode</h4>
            <p>
              Switch on the debug mode by appending <i>?formbricksDebug=true</i> to the URL where you load the
              Formbricks SDK. Open the browser console to see the logs.{" "}
              <Link
                className="decoration-brand-dark"
                href="https://formbricks.com/docs/developer-docs/app-survey-sdk#debug-mode"
                target="_blank">
                Read docs.
              </Link>{" "}
            </p>
            <h4>You&apos;re done 🎉</h4>
            <p>
              Your {type} now communicates with Formbricks - sending events, and loading surveys
              automatically!
            </p>

            <ul className="list-disc text-sm text-slate-700">
              <li>
                <span>Need a more detailed setup guide for React, Next.js or Vue.js?</span>{" "}
                <Link
                  className="decoration-brand-dark"
                  href="https://formbricks.com/docs/website-surveys/quickstart"
                  target="_blank">
                  Check out the docs.
                </Link>
              </li>
              <li>
                <span>Not working?</span>{" "}
                <Link className="decoration-brand-dark" href="https://formbricks.com/discord" target="_blank">
                  Join Discord
                </Link>{" "}
                or{" "}
                <Link
                  className="decoration-brand-dark"
                  target="_blank"
                  href="https://github.com/formbricks/formbricks/issues">
                  open an issue on GitHub
                </Link>{" "}
              </li>
              <li>
                <span>Want to learn how to add user attributes, custom events and more?</span>{" "}
                <Link
                  className="decoration-brand-dark"
                  href="https://formbricks.com/docs/attributes/why"
                  target="_blank">
                  Dive into the docs.
                </Link>
              </li>
            </ul>
          </div>
        ) : activeTab === "html" ? (
          <div className="prose prose-slate prose-p:my-2 prose-p:text-sm prose-p:text-slate-600 prose-h4:text-slate-800 prose-h4:pt-2">
            <h4>Step 1: Copy and paste code</h4>
            <p>
              Insert this code into the <code>{`<head>`}</code> tag of your {type}:
            </p>
            <CodeBlock language="js">{`<!-- START Formbricks Surveys -->
<script type="text/javascript">
!function(){var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src="${webAppUrl}/api/packages/${type}";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.init({environmentId: "${environmentId}", ${type === "app" ? `\n    userId: "<user-id>",` : ""} apiHost: "${window.location.protocol}//${window.location.host}"})},500)}();
</script>
<!-- END Formbricks Surveys -->`}</CodeBlock>
            <h4>Step 2: Debug mode</h4>
            <p>
              Switch on the debug mode by appending <i>?formbricksDebug=true</i> to the URL where you load the
              Formbricks SDK. Open the browser console to see the logs.{" "}
              <Link
                className="decoration-brand-dark"
                href="https://formbricks.com/docs/developer-docs/app-survey-sdk#debug-mode"
                target="_blank">
                Read docs.
              </Link>{" "}
            </p>
            <h4>You&apos;re done 🎉</h4>
            <p>
              Your {type} now communicates with Formbricks - sending events, and loading surveys
              automatically!
            </p>
            <ul className="list-disc text-sm text-slate-700">
              <li>
                <span className="font-semibold">Does your widget work? </span>
                <span>Scroll to the top!</span>
              </li>
              <li>
                <span className="font-semibold">Have a problem?</span>{" "}
                <Link
                  className="decoration-brand-dark"
                  target="_blank"
                  href="https://github.com/formbricks/formbricks/issues">
                  Open an issue on GitHub
                </Link>{" "}
                or{" "}
                <Link className="decoration-brand-dark" href="https://formbricks.com/discord" target="_blank">
                  join Discord.
                </Link>
              </li>
              <li>
                <span className="font-semibold">
                  Want to learn how to add user attributes, custom events and more?
                </span>{" "}
                <Link
                  className="decoration-brand-dark"
                  href="https://formbricks.com/docs/attributes/why"
                  target="_blank">
                  Dive into the docs.
                </Link>
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
};
