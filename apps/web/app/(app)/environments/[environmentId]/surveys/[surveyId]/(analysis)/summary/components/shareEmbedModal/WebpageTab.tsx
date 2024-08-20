"use client";

import { CopyIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Button } from "@formbricks/ui/Button";
import { CodeBlock } from "@formbricks/ui/CodeBlock";

export const WebpageTab = ({ surveyUrl }) => {
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
