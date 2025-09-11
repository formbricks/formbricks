import { Code2Icon, MousePointerClickIcon } from "lucide-react";

export const ACTION_TYPE_ICON_LOOKUP = {
  code: <Code2Icon className="h-4 w-4" data-testid="code-icon" />,
  noCode: <MousePointerClickIcon className="h-4 w-4" data-testid="nocode-icon" />,
};
