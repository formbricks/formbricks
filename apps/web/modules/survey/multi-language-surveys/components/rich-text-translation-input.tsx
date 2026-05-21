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
  // Tracks the most recent value the editor itself produced via setText, so we
  // can tell external updates (e.g. AI translation fill) apart from the editor's
  // own write-back and only remount for the former.
  const lastWrittenRef = useRef(value);

  useEffect(() => {
    if (value !== lastWrittenRef.current) {
      lastWrittenRef.current = value;
      setEditorKey((k) => k + 1);
      setFirstRender(true);
    }
  }, [value]);

  return (
    <div className={disabled ? "cursor-not-allowed rounded-md opacity-60" : "rounded-md"}>
      <Editor
        key={`${path}-${editorKey}`}
        disableLists
        excludedToolbarItems={["blockType"]}
        firstRender={firstRender}
        setFirstRender={setFirstRender}
        getText={() => md.render(value)}
        setText={(v: string) => {
          lastWrittenRef.current = v;
          onChange(path, v);
        }}
        localSurvey={localSurvey}
        elementId={elementId}
        selectedLanguageCode={languageCode}
        editable={!disabled}
      />
    </div>
  );
};
