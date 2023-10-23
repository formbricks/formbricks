// components/ui/CodeBlock.tsx
import Prism from "prismjs";
import "prismjs/themes/prism.css";
import React, { CSSProperties, useEffect } from "react";

interface CodeBlockProps {
  children: React.ReactNode;
}

const styles: Record<string, CSSProperties> = {
  div: {
    position: "relative",
    marginTop: "1rem",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    fontWeight: "lighter",
    color: "#e5e7eb",
  },
  pre: {
    background: "none",
  },
  code: {
    textShadow: "none",
    color: "#fbbf24",
  },
};

const CodeBlock: React.FC<CodeBlockProps> = ({ children }) => {
  useEffect(() => {
    Prism.highlightAll();
  }, [children]);

  return (
    <div style={styles.div} className="code-block-container">
      <pre style={styles.pre}>
        <code style={styles.code} className="language-js">
          {children}
        </code>
      </pre>
      <style jsx global>{`
        .operator {
          background: none !important;
        }
      `}</style>
    </div>
  );
};

export default CodeBlock;
