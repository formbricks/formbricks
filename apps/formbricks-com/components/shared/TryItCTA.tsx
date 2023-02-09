import { Button } from "@formbricks/ui";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";

export default function HeadingCentered() {
  const router = useRouter();
  return (
    <div className="mx-auto grid max-w-md grid-cols-1 content-center gap-10 px-4 py-12 sm:max-w-3xl sm:px-6 md:grid-cols-2 md:pt-24 md:pb-36 lg:max-w-6xl lg:px-8">
      <div className="">
        <p className="text-md text-brand-dark dark:text-brand-light mb-3 font-semibold uppercase">
          What are you waiting for?
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-4xl">
          Try it right now!
        </h2>
        <p className="my-3 text-slate-500 dark:text-slate-300 sm:mb-6 sm:mt-4 md:text-lg">
          Dive right in or browse docs for examples.
          <br />
          Questions? Join our Discord, we’re happy to help!
        </p>
        <Button variant="secondary" onClick={() => router.push("/docs")}>
          Read docs
        </Button>
        <Button variant="primary" className="ml-3" onClick={() => router.push("/waitlist")}>
          Get started
        </Button>
      </div>
      <div className="flex items-center">
        <div className="flex h-20 w-full items-center justify-between rounded-lg bg-slate-800 px-8 text-slate-100 ">
          <p>npm install @formbricks/react</p>
          <button onClick={() => navigator.clipboard.writeText("npm install @formbricks/react")}>
            <DocumentDuplicateIcon className="h-8 w-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
