"use client";

import { cn } from "@formbricks/lib/cn";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import React, { useEffect } from "react";
import toast from "react-hot-toast";

interface CodeBlockProps {
  children: React.ReactNode;
  language: string;
  customCodeClass?: string;
  showCopyToClipboard?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  children,
  language,
  customCodeClass = "",
  showCopyToClipboard = true,
}) => {
  useEffect(() => {
    Prism.highlightAll();
  }, [children]);

  return (
    <div className="group relative mt-4 rounded-md text-sm text-slate-200">
      {showCopyToClipboard && (
        <DocumentDuplicateIcon
          className="absolute right-4 top-4 z-20 h-5 w-5 cursor-pointer text-slate-600 opacity-0 transition-all duration-150 group-hover:opacity-60"
          onClick={() => {
            const childText = children?.toString() || "";
            navigator.clipboard.writeText(childText);
            toast.success("Copied to clipboard");
          }}
        />
      )}
      <pre>
        <code className={cn(`language-${language} whitespace-pre-wrap`, customCodeClass)}>{children}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
