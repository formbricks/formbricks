import { Button } from "./Button";

interface CardProps {
  connectText?: string;
  connectHref?: string;
  connectNewTab?: boolean;
  docsText?: string;
  docsHref?: string;
  docsNewTab?: boolean;
  label: string;
  description: string;
  icon?: React.ReactNode;
}

export type { CardProps };

export const Card: React.FC<CardProps> = ({
  connectText,
  connectHref,
  connectNewTab,
  docsText,
  docsHref,
  docsNewTab,
  label,
  description,
  icon,
}) => (
  <div className="rounded-lg bg-white p-8 text-left shadow-sm ">
    {icon && <div className="mb-6 h-8 w-8">{icon}</div>}
    <h3 className="text-lg font-bold text-slate-800">{label}</h3>
    <p className="text-xs text-slate-500">{description}</p>
    <div className="mt-4 flex space-x-2">
      {connectHref && (
        <Button href={connectHref} target={connectNewTab ? "_blank" : "_self"} size="sm" variant="darkCTA">
          {connectText}
        </Button>
      )}
      {docsHref && (
        <Button href={docsHref} target={docsNewTab ? "_blank" : "_self"} size="sm" variant="secondary">
          {docsText}
        </Button>
      )}
    </div>
  </div>
);
