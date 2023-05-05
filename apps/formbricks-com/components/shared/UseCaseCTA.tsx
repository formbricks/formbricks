import { Button } from "@formbricks/ui";
import { ArrowRightIcon } from "@heroicons/react/24/solid";

interface UseCaseCTAProps {
  href: string;
}

export default function UseCaseHeader({ href }: UseCaseCTAProps) {
  return (
    <div className="my-4 flex items-center space-x-2">
      <Button variant="secondary" href={href}>
        Step-by-step manual
      </Button>
      <Button variant="darkCTA" href="https://app.formbricks.com/auth/signup" EndIcon={ArrowRightIcon}>
        Sign up (free)
      </Button>
    </div>
  );
}
