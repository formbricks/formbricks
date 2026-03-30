import { Button } from "@react-email/components";

interface EmailButtonProps {
  readonly label: string;
  readonly href: string;
}

export function EmailButton({ label, href }: EmailButtonProps): React.JSX.Element {
  return (
    <Button className="rounded-md bg-black px-6 py-3 text-sm text-white" href={href}>
      {label}
    </Button>
  );
}

export default EmailButton;
