"use client";

import { CodeIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";

interface SetupInstructionsProps {
  htmlSnippet: string;
  aiPrompt: string;
}

export const SetupInstructions = ({ htmlSnippet, aiPrompt }: Readonly<SetupInstructionsProps>) => {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState<"ai" | "code">("ai");

  const options = [
    {
      value: "ai",
      label: t("workspace.app-connection.connect_with_ai"),
      icon: <SparklesIcon className="size-4" />,
    },
    {
      value: "code",
      label: t("workspace.app-connection.view_code_snippet"),
      icon: <CodeIcon className="size-4" />,
    },
  ];

  return (
    <div className="space-y-4">
      <OptionsSwitch
        options={options}
        currentOption={selectedOption}
        handleOptionChange={(value) => setSelectedOption(value as "ai" | "code")}
      />
      {selectedOption === "ai" ? (
        <CodeBlock
          customEditorClass="!bg-white border border-slate-200 max-h-52 overflow-y-auto"
          language="markdown"
          noMargin>
          {aiPrompt}
        </CodeBlock>
      ) : (
        <CodeBlock customEditorClass="!bg-white border border-slate-200" language="html" noMargin>
          {htmlSnippet}
        </CodeBlock>
      )}
    </div>
  );
};
