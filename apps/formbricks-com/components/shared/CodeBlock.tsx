// components/ui/CodeBlock.tsx
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import React, { useEffect } from "react";

interface CodeBlockProps {
  children: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children }) => {
  useEffect(() => {
    Prism.highlightAll();
  }, [children]);

  return (
    <div className="group relative mt-4 rounded-md text-sm font-light text-slate-200 sm:text-base">
      <pre className="!bg-transparent">
        <code className="language-js !text-amber-400" style={{ textShadow: "none" }}>
          {children}
        </code>
      </pre>
    </div>
  );
};

export default CodeBlock;
