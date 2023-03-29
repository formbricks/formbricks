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
    <div className="group relative mt-4 rounded-md font-light text-slate-200">
      <pre>
        <code className="language-js whitespace-pre-wrap">{children}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
