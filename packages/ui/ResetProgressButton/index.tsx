import { Repeat2 } from "lucide-react";
import { Button } from "../Button";

interface ResetProgressButtonProps {
  onClick: () => void;
}

export const ResetProgressButton = ({ onClick }: ResetProgressButtonProps) => {
  return (
    <Button
      variant="minimal"
      className="py-0.2 mr-2 bg-white px-2 font-sans text-sm text-slate-500"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}>
      Restart
      <Repeat2 className="ml-2 h-4 w-4" />
    </Button>
  );
};
