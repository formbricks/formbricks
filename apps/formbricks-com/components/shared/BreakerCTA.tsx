import { Button } from "@formbricks/ui";
import { useRouter } from "next/router";
import clsx from "clsx";

interface Props {
  teaser: string;
  headline: string;
  subheadline: string;
  cta: string;
  href: string;
  inverted?: boolean;
}

export default function BreakerCTA({ inverted = false, teaser, headline, subheadline, cta, href }: Props) {
  const router = useRouter();
  return (
    <div
      className={clsx(
        inverted
          ? "from-slate-800 via-slate-800 to-slate-700 dark:from-slate-200  dark:to-slate-300"
          : "from-slate-200 to-slate-300 dark:from-slate-800 dark:via-slate-800  dark:to-slate-700",
        "xs:mx-auto xs:w-full mx-4 mb-12 max-w-5xl rounded-xl bg-gradient-to-br md:mb-0 "
      )}>
      <div className="relative px-4 py-8 sm:px-6 sm:pt-8 sm:pb-12 lg:px-8 lg:pt-12">
        <div className="xs:block xs:absolute xs:right-10 hidden md:top-1/2 md:-translate-y-1/2">
          <Button variant="highlight" onClick={() => router.push(`${href}`)}>
            {cta}
          </Button>
        </div>
        <p className="lg:text-md dark:text-brand-dark text-brand-light text-sm font-semibold uppercase">
          {teaser}
        </p>
        <h2
          className={clsx(
            inverted ? "text-slate-200 dark:text-slate-800" : "text-slate-800 dark:text-slate-200",
            "mt-4 text-2xl font-bold tracking-tight lg:text-3xl "
          )}>
          {headline}
        </h2>
        <p
          className={clsx(
            inverted ? "text-slate-300 dark:text-slate-500" : "text-slate-500 dark:text-slate-300",
            "text-md mt-4 max-w-3xl lg:text-lg"
          )}>
          {subheadline}
        </p>
        <div className="xs:hidden mt-4">
          <Button variant="highlight" target="_blank" onClick={() => router.push(`${href}`)}>
            {cta}
          </Button>
        </div>
      </div>
    </div>
  );
}
