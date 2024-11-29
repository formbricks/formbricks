import { Button } from "@/modules/ui/components/button";
import { Muted, P } from "@/modules/ui/components/typography";

export type ModalButton = {
  text: string;
  href?: string;
  onClick?: () => void;
};

interface EmptyContentProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttons: [ModalButton, ModalButton];
}

export const EmptyContent = ({ icon, title, description, buttons }: EmptyContentProps) => {
  const [primaryButton, secondaryButton] = buttons;

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="rounded-md border border-slate-200 p-3">{icon}</div>
      <div className="flex flex-col items-center gap-2">
        <P className="text-xl font-semibold text-slate-900">{title}</P>
        <Muted className="text-slate-500">{description}</Muted>
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
