import React from "react";

interface HelpProps {
  help: string;
  elemId: string;
}

export function Help({ help, elemId }: HelpProps) {
  return (
    <div className="formbricks-help" id={`help-${elemId}`}>
      {help}
    </div>
  );
}
