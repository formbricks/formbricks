"use client";

import { useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { md } from "@/lib/markdownIt";
import { Editor } from "@/modules/ui/components/editor";

interface RichTextTranslationInputProps {
  path: string;
  value: string;
  onChange: (path: string, value: string) => void;
  localSurvey: TSurvey;
  languageCode: string;
  elementId: string;
  disabled?: boolean;
}

export const RichTextTranslationInput = ({
  path,
  value,
  onChange,
  localSurvey,
  languageCode,
  elementId,
  disabled,
}: RichTextTranslationInputProps) => {
  const [firstRender, setFirstRender] = useState(true);

  return (
    <div className="rounded-md">
      <Editor
        key={path}
        disableLists
        excludedToolbarItems={["blockType"]}
        firstRender={firstRender}
        setFirstRender={setFirstRender}
        getText={() => md.render(value)}
        setText={(v: string) => onChange(path, v)}
        localSurvey={localSurvey}
        elementId={elementId}
        selectedLanguageCode={languageCode}
        editable={!disabled}
      />
    </div>
  );
};
