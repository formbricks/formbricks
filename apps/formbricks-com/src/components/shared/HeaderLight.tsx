import { Button } from "@formbricks/ui";
import { Popover } from "@headlessui/react";
import { usePlausible } from "next-plausible";
import Link from "next/link";
import { useRouter } from "next/router";
import { FooterLogo } from "./Logo";

export default function HeaderLight() {
  const plausible = usePlausible();
  const router = useRouter();
  return (
    <Popover className="relative" as="header">
      <div className="mx-auto flex items-center justify-between py-6 sm:px-2 md:justify-start  lg:px-8 xl:px-12 ">
        <div className="flex w-0 flex-1 justify-start">
          <Link href="/">
            <span className="sr-only">Formbricks</span>
            <FooterLogo className="ml-7 h-8 w-auto sm:h-10" />
          </Link>
        </div>

        <div className="hidden flex-1 items-center justify-end md:flex">
          <Button
            variant="secondary"
            onClick={() => {
              router.push("https://cal.com/johannes/onboarding");
              plausible("Demo_CTA_TalkToUs");
            }}>
            Talk to us
          </Button>
          <Button
            variant="highlight"
            className="ml-2"
            onClick={() => {
              router.push("https://app.formbricks.com/auth/signup");
              plausible("Demo_CTA_TryForFree");
            }}>
            Start for free
          </Button>
        </div>
      </div>
    </Popover>
  );
}
