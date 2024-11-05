import { Button } from "@formbricks/ui/components/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/components/Tooltip";

interface IconBarProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  className?: string;
}

export const IconBar = ({ icon, tooltip, onClick, href, className = "" }: IconBarProps) => {
  const handleClick = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).blur();
    onClick?.(e);
  };

  return (
    <TooltipProvider delayDuration={50}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleClick}
            href={href}
            variant="minimal"
            size="sm"
            className={`border-formbricks-border-primary rounded-none border-y-0 border-l-0 bg-transparent focus:ring-0 ${className}`}>
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
