import clsx from "clsx";
import { useState } from "react";
import { IoLogoHtml5, IoLogoNpm } from "react-icons/io5";
import CodeBlock from "../shared/CodeBlock";
import CopyButton from "@/components/shared/CopyButton";

interface SecondNavbarProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  activeId: string;
  setActiveId: (id: string) => void;
}

export const TabBar: React.FC<SecondNavbarProps> = ({ tabs, activeId, setActiveId }) => {
  return (
    <div className="flex h-14 items-center justify-center rounded-lg  bg-slate-200 dark:bg-slate-700">
      <nav className="flex h-full items-center space-x-4" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={clsx(
              tab.id === activeId
                ? " border-brand-dark border-b-2 font-semibold text-slate-900 dark:text-slate-300"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              "flex h-full items-center px-3 text-sm font-medium"
            )}
            aria-current={tab.id === activeId ? "page" : undefined}>
            {tab.icon && <div className="flex h-5 w-5 items-center">{tab.icon}</div>}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

const tabs = [
  { id: "npm", label: "NPM", icon: <IoLogoNpm /> },
  { id: "html", label: "HTML", icon: <IoLogoHtml5 /> },
];

export const SetupInstructions: React.FC = ({}) => {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  return (
    <div>
      <TabBar tabs={tabs} activeId={activeTab} setActiveId={setActiveTab} />
      <div className="h-[20.5rem] max-w-lg  pl-4 pr-2 sm:max-w-lg md:max-w-lg lg:h-[22.5rem]">
        {activeTab === "npm" ? (
          <>
            <div className="flex items-center gap-2">
              <CodeBlock>npm install @formbricks/js</CodeBlock>
              <CopyButton text="npm install @formbricks/js" />
            </div>
            <div className="flex items-center gap-2">
              <CodeBlock>{`import formbricks from "@formbricks/js";

if (typeof window !== "undefined") {
  formbricks.init({
    environmentId: "claV2as2kKAqF28fJ8",
    apiHost: "https://app.formbricks.com",
  });
}`}</CodeBlock>
              <CopyButton
                text={`import formbricks from "@formbricks/js";

              if (typeof window !== "undefined") {
                formbricks.init({
                  environmentId: "claV2as2kKAqF28fJ8",
                  apiHost: "https://app.formbricks.com",
                });
}`}
              />
            </div>
          </>
        ) : activeTab === "html" ? (
          <div className="flex flex-col ">
            <CodeBlock>{`<script type="text/javascript">
!function(){var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src="https://unpkg.com/@formbricks/js@^1.1.2/dist/index.umd.js";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.init("claDadXk29dak92dK9","https://app.formbricks.com")},500)}();
</script>`}</CodeBlock>
            <CopyButton
              text={`<script type="text/javascript">
!function(){var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src="https://unpkg.com/@formbricks/js@^1.1.2/dist/index.umd.js";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.init("claDadXk29dak92dK9","https://app.formbricks.com")},500)}();
</script>`}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SetupInstructions;
