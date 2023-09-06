import { Button } from "@formbricks/ui";

interface BackButtonProps {
  onClick: () => void;
  backButtonLabel?: string;
}

export function BackButton({ onClick, backButtonLabel }: BackButtonProps) {
  return (
    <Button
      type="button"
      variant="minimal"
      className="mr-auto px-3 py-3 text-base font-medium leading-4 focus:ring-offset-2"
      onClick={() => onClick()}>
      {backButtonLabel || "Back"}
    </Button>
  );
}
