"use client";

import { DocumentDuplicateIcon } from "@heroicons/react/24/solid";
import toast from "react-hot-toast";

import { Button } from "@formbricks/ui/Button";
import CodeBlock from "@formbricks/ui/CodeBlock";

export default function ReactNativeTab({ surveyId }) {
  const javascriptCode = `
  import {FormBricks, FormBrickContainer} from "@formbricks/reactnative"

  const showSurvey = () => {
    FormBricks.showSurvey("${surveyId}")
  }

  const Demo() {
    retun (
      <FormBrickContainer/>
    )
  }
  `;

  return (
    <div className="flex h-full grow flex-col gap-5">
      <div className="flex justify-between">
        <div className=""></div>
        <Button
          variant="darkCTA"
          title="Embed survey in a mobile app"
          aria-label="Embed survey in a mobile app"
          onClick={() => {
            navigator.clipboard.writeText(javascriptCode);
            toast.success("Embed code copied to clipboard!");
          }}
          EndIcon={DocumentDuplicateIcon}>
          Copy code
        </Button>
      </div>
      <div className="grow overflow-y-scroll rounded-xl border border-gray-200 bg-white px-4 py-[18px]">
        <CodeBlock
          customCodeClass="!whitespace-normal sm:!whitespace-pre-wrap !break-all sm:!break-normal"
          language="javascript"
          showCopyToClipboard={false}>
          {javascriptCode}
        </CodeBlock>
      </div>
    </div>
  );
}
