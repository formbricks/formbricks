import { Button } from "@/modules/ui/components/button";

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
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="rounded-md border border-slate-200 p-3">{icon}</div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-xl font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex gap-3">
        <Button
          {...(primaryButton.href
            ? { href: primaryButton.href, target: "_blank", rel: "noopener noreferrer" }
            : {})}
          {...(primaryButton.onClick ? { onClick: primaryButton.onClick } : {})}>
          {primaryButton.text}
        </Button>
        <Button
          variant="secondary"
          {...(secondaryButton.href
            ? { href: secondaryButton.href, target: "_blank", rel: "noopener noreferrer" }
            : {})}
          {...(secondaryButton.onClick ? { onClick: secondaryButton.onClick } : {})}>
          {secondaryButton.text}
        </Button>
      </div>
    </div>
  );
};
