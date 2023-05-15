import { Button } from "@formbricks/ui";
import { useRouter } from "next/router";

interface UseCaseCTAProps {
  href: string;
}

export default function UseCaseHeader({ href }: UseCaseCTAProps) {
  /*   const plausible = usePlausible(); */
  const router = useRouter();
  return (
    <div className="my-8 flex space-x-2 whitespace-nowrap">
      <Button variant="secondary" href={href}>
        Step-by-step manual
      </Button>
      <div className="space-y-1 text-center">
        <Button
          variant="darkCTA"
          onClick={() => {
            router.push("https://app.formbricks.com/auth/signup");
            /* plausible("BestPractice_SubPage_CTA_TryItNow"); */
          }}>
          Try it now
        </Button>
        <p className="text-xs text-slate-400">It&apos;s free</p>
      </div>
    </div>
  );
}
