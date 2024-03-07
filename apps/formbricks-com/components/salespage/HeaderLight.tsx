import { Popover } from "@headlessui/react";
import { usePlausible } from "next-plausible";
import Link from "next/link";
import { useRouter } from "next/router";

import { Button } from "@formbricks/ui/Button";

import { FooterLogo } from "../shared/Logo";

export default function HeaderLight() {
  const plausible = usePlausible();
  const router = useRouter();
  return (
    <Popover className="relative" as="header">
      <div className="max-w-8xl mx-auto flex items-center justify-between px-6 py-6  md:justify-start lg:px-10 xl:px-12">
        <div className="flex w-0 flex-1 justify-start">
          <Link href="/">
            <span className="sr-only">Formbricks</span>
            <FooterLogo className="h-8 w-auto sm:h-10" />
          </Link>
        </div>

        <div className="flex-1 items-center justify-end md:flex">
          {/*  <Button
            variant="secondary"
            onClick={() => {
              router.push("https://cal.com/johannes/formbricks-demo");
              plausible("Demo_CTA_TalkToUs");
            }}>
            Talk to us
          </Button> */}
          <Button
            variant="highlight"
            className="px-4 md:px-6"
            onClick={() => {
              router.push("https://app.formbricks.com/auth/signup");
              plausible("Demo_CTA_TryForFree");
            }}>
            Get started - it&apos;s free!
          </Button>
        </div>
      </div>
    </Popover>
  );
}
