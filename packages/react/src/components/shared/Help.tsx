import clsx from "clsx";

interface HelpProps {
  help?: string;
  elemId: string;
  helpClassName?: string;
}

export function Help({ help, elemId, helpClassName }: HelpProps) {
  if (!help) {
    return null;
  }
  return (
    <div className={helpClassName || "formbricks-help"} id={`help-${elemId}`}>
      {help}
    </div>
  );
}
