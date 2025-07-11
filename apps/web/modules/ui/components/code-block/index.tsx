"use client";

import { cn } from "@/lib/cn";
import { useTranslate } from "@tolgee/react";
import { CopyIcon } from "lucide-react";
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import React, { useEffect } from "react";
import toast from "react-hot-toast";
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
  const { t } = useTranslate();
  useEffect(() => {
    Prism.highlightAll();
  }, [children]);

  return (
    <div className={cn("group relative rounded-md text-sm text-slate-200", noMargin ? "" : "mt-4")}>
      {showCopyToClipboard && (
        <div className="absolute right-2 top-2 z-20 flex cursor-pointer items-center justify-center p-1.5 text-slate-500 hover:text-slate-900">
          <CopyIcon
            data-testid="copy-icon"
            onClick={() => {
              const childText = children?.toString() || "";
              navigator.clipboard.writeText(childText);
              toast.success(t("common.copied_to_clipboard"));
            }}
            className="h-4 w-4"
          />
        </div>
      )}
      <pre className={customEditorClass}>
        <code className={cn(`language-${language} whitespace-pre-wrap`, customCodeClass)}>{children}</code>
      </pre>
    </div>
  );
};
