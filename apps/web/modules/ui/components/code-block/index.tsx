"use client";

import { CopyIcon } from "lucide-react";
import Prism from "prismjs";
// The default prismjs bundle only registers markup, css, clike, and javascript.
// These languages are used by CodeBlock consumers (e.g. install method snippets)
// but need their grammars imported explicitly. clike must load before kotlin and
// dart, which extend it; typescript extends the already-bundled javascript.
import "prismjs/components/prism-clike";
import "prismjs/components/prism-dart";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-typescript";
import "prismjs/themes/prism.css";
import React, { useEffect } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import "./style.css";

interface CodeBlockProps {
  children: React.ReactNode;
  language: string;
  customCodeClass?: string;
  customEditorClass?: string;
  showCopyToClipboard?: boolean;
  noMargin?: boolean;
}

export const CodeBlock = ({
  children,
  language,
  customEditorClass = "",
  customCodeClass = "",
  showCopyToClipboard = true,
  noMargin = false,
}: CodeBlockProps) => {
  const { t } = useTranslation();
  useEffect(() => {
    Prism.highlightAll();
  }, [children]);

  return (
    <div className={cn("group relative w-full rounded-md text-xs", noMargin ? "" : "mt-4")}>
      {showCopyToClipboard && (
        <div className="absolute top-2 right-2 z-20 flex cursor-pointer items-center justify-center p-1.5 text-slate-500 hover:text-slate-900">
          <CopyIcon
            data-testid="copy-icon"
            onClick={() => {
              const childText = children?.toString() || "";
              navigator.clipboard.writeText(childText);
              toast.success(t("common.copied_to_clipboard"));
            }}
            className="size-4"
          />
        </div>
      )}
      <pre className={cn("w-full overflow-x-auto rounded-lg", customEditorClass)}>
        <code className={cn(`language-${language} whitespace-pre-wrap`, customCodeClass)}>{children}</code>
      </pre>
    </div>
  );
};
