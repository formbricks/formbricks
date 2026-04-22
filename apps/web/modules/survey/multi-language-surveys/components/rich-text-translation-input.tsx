"use client";

import { useEffect, useRef, useState } from "react";
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
  const [editorKey, setEditorKey] = useState(0);
  const prevDisabledRef = useRef(disabled);

  // Remount the editor when AI translation finishes (disabled transitions from true → false)
  // so the editor picks up the externally populated value.
  useEffect(() => {
    if (prevDisabledRef.current && !disabled) {
      setEditorKey((k) => k + 1);
      setFirstRender(true);
    }
    prevDisabledRef.current = disabled;
  }, [disabled]);

  return (
    <div className={disabled ? "pointer-events-none rounded-md opacity-60" : "rounded-md"}>
      <Editor
        key={`${path}-${editorKey}`}
        disableLists
        excludedToolbarItems={["blockType"]}
        firstRender={firstRender}
        setFirstRender={setFirstRender}
        getText={() => md.render(value)}
        setText={(v: string) => onChange(path, v)}
        localSurvey={localSurvey}
        elementId={elementId}
        selectedLanguageCode={languageCode}
        editable
      />
    </div>
  );
};
