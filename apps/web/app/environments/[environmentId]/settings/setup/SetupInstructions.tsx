"use client";

import TabBar from "@/components/ui/TabBar";
import Link from "next/link";
import { useState } from "react";
import { IoLogoHtml5, IoLogoReact } from "react-icons/io5";

const tabs = [
  { id: "react", label: "React", icon: <IoLogoReact /> },
  { id: "html", label: "HTML", icon: <IoLogoHtml5 /> },
];

export default function SetupInstructions({ environmentId }) {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  return (
    <div>
      <TabBar tabs={tabs} activeId={activeTab} setActiveId={setActiveTab} />
      <div className="px-6 py-5">
        {activeTab === "react" ? (
          <div className="prose">
            <p>First install `@formbricks/js` via npm:</p>
            <code>npm install @formbricks/js</code>
            <p>Then import Formbricks and initialize the widget in your Component (e.g. App.tsx):</p>
            <code className="whitespace-pre-wrap">{`
import formbricks from "@formbricks/js";

if (typeof window !== "undefined") {
  formbricks.init({
    environmentId: "${environmentId}",
    apiHost: "${window.location.protocol}//${window.location.host}",
  });
}`}</code>
            <p>
              Your app now communicates with Formbricks - sending events, and loading surveys automatically 🎉
            </p>
            <p>
              To learn more about how you can identify users, track events and set attributes, check out the{" "}
              <Link href="https://formbricks.com/docs" target="_blank">
                docs
              </Link>
              .
            </p>
          </div>
        ) : activeTab === "html" ? (
          <div className="prose">
            <p>Insert this code into the head of your website:</p>
            <code className="whitespace-pre-wrap">{`
<script type="text/javascript">
!function(){var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src="./dist/index.umd.js";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.init("${environmentId}","${window.location.protocol}//${window.location.host}")},500)}();
</script>`}</code>
            <p>
              Your app now communicates with Formbricks - sending events, and loading surveys automatically 🎉
            </p>
            <p>
              To learn more about how you can identify users, track events and set attributes, check out the{" "}
              <Link href="https://formbricks.com/docs" target="_blank">
                docs
              </Link>
              .
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
