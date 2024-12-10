import { Button } from "@/modules/ui/components/button";
import Link from "next/link";

export type ModalButton = {
  text: string;
  href?: string;
  onClick?: () => void;
};

interface UpgradePromptProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttons: [ModalButton, ModalButton];
}

export const UpgradePrompt = ({ icon, title, description, buttons }: UpgradePromptProps) => {
  const [primaryButton, secondaryButton] = buttons;

  return (
    <div className="flex w-full flex-col items-center gap-6 p-6">
      <div className="rounded-md border border-slate-200 p-3">{icon}</div>
      <div className="flex max-w-[80%] flex-col items-center gap-2 text-center">
        <p className="text-xl font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex gap-3">
        {primaryButton.href ? (
          <Button asChild>
            <Link href={primaryButton.href} target="_blank" rel="noopener noreferrer">
              {primaryButton.text}
            </Link>
          </Button>
        ) : (
          <Button onClick={primaryButton.onClick}>{primaryButton.text}</Button>
        )}
        {secondaryButton.href ? (
          <Button variant="secondary" asChild>
            <Link href={secondaryButton.href} target="_blank" rel="noopener noreferrer">
              {secondaryButton.text}
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" onClick={secondaryButton.onClick}>
            {secondaryButton.text}
          </Button>
        )}
      </div>
    </div>
  );
};
