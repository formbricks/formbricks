"use client";

import { CopyIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { AdvancedOptionToggle } from "@formbricks/ui/components/AdvancedOptionToggle";
import { Button } from "@formbricks/ui/components/Button";
import { CodeBlock } from "@formbricks/ui/components/CodeBlock";
import { OptionsSwitch } from "@formbricks/ui/components/OptionsSwitch";

export const WebsiteTab = ({ surveyUrl, environmentId }) => {
  const [selectedTab, setSelectedTab] = useState("static");

  return (
    <div className="flex h-full grow flex-col">
      <OptionsSwitch
        options={[
          { value: "static", label: "Static (iframe)" },
          { value: "popup", label: "Dynamic (Pop-up)" },
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
            toast.success("Embed code copied to clipboard!");
          }}
          EndIcon={CopyIcon}>
          Copy code
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
          title="Embed Mode"
          description="Embed your survey with a minimalist design, discarding padding and background."
          childBorder={true}
        />
      </div>
    </div>
  );
};

const PopupTab = ({ environmentId }) => {
  return (
    <div>
      <p className="text-lg font-semibold text-slate-800">How to embed a pop-up survey on your website</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>
          Follow these{" "}
          <Link
            href={`/environments/${environmentId}/product/website-connection`}
            target="_blank"
            className="decoration-brand-dark font-medium underline underline-offset-2">
            setup instructions
          </Link>{" "}
          to connect your website with Formbricks
        </li>
        <li>
          Make sure the survey type is set to <b>Website survey</b>
        </li>
        <li>Define when and where the survey should pop up</li>
      </ol>
      <div className="mt-4">
        <video autoPlay loop muted className="w-full rounded-xl border border-slate-200">
          <source src="/video/tooltips/change-survey-type.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
};
