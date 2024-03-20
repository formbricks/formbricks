"use client";

import { CopyIcon } from "lucide-react";
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import React, { useEffect } from "react";
import toast from "react-hot-toast";

import { cn } from "@formbricks/lib/cn";

import "./style.css";

interface CodeBlockProps {
  children: React.ReactNode;
  language: string;
  customCodeClass?: string;
  customEditorClass?: string;
  showCopyToClipboard?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  children,
  language,
  customEditorClass = "",
  customCodeClass = "",
  showCopyToClipboard = true,
}) => {
  useEffect(() => {
    Prism.highlightAll();
  }, [children]);

  return (
    <div className="group relative mt-4 rounded-md text-sm text-slate-200">
      {showCopyToClipboard && (
        <div className="absolute right-2 top-2 z-20 h-8 w-8 cursor-pointer rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200">
          <CopyIcon
            className=""
            onClick={() => {
              const childText = children?.toString() || "";
              navigator.clipboard.writeText(childText);
              toast.success("Copied to clipboard");
            }}
          />
        </div>
      )}
      <pre className={customEditorClass}>
        <code className={cn(`language-${language} whitespace-pre-wrap`, customCodeClass)}>{children}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
