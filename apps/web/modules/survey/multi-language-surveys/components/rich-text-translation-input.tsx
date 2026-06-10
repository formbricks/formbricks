"use client";

import { useEffect, useRef, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
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
  // Separates external value changes (e.g. AI fill) from the editor's own write-back so we
  // only remount for the former.
  const lastWrittenRef = useRef(value);
  // Suppresses Lexical's mount-time empty listener fire which would otherwise clobber an
  // externally-applied value back to empty. Lexical can serialize an empty editor as either
  // "" or markup like "<p><br></p>", so we check by text content rather than literal equality.
  const initialContentSetRef = useRef(false);

  useEffect(() => {
    if (value !== lastWrittenRef.current) {
      lastWrittenRef.current = value;
      initialContentSetRef.current = false;
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
          if (!initialContentSetRef.current && getTextContent(v).trim() === "") return;
          initialContentSetRef.current = true;
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
