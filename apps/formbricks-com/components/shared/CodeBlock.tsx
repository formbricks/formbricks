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

  const codestyle = {
    textShadow: "none",
    background: "none !important",
    color: "white !important",
  };

  return (
    <div className="group relative mt-4 rounded-md text-sm font-light text-slate-200 sm:text-base">
      <pre className="rounded-md dark:bg-slate-700">
        <code style={codestyle} className="language-js">
          {children}
        </code>
      </pre>
    </div>
  );
};

export default CodeBlock;
