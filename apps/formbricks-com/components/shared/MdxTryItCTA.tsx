import Button from "./Button";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";

export default function HeadingCentered() {
  const router = useRouter();
  return (
    <div className="mx-auto grid grid-cols-1 content-center gap-10 pt-24 pb-12 md:grid-cols-2">
      <div className="">
        <p className="text-md text-brand-dark dark:text-brand-light font-semibold uppercase">
          What are you waiting for?
        </p>
        <p className="my-0 text-4xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          Try it right now!
        </p>
        <p className="text-slate-500 dark:text-slate-300 ">
          Dive right in or browse docs for examples. Questions? Join our Discord, we’re happy to help
        </p>
        <Button variant="secondary" onClick={() => router.push("/discord")}>
          Join Discord
        </Button>
        <Button variant="primary" className="ml-3" onClick={() => router.push("/get-started")}>
          Get started
        </Button>
      </div>
      <div className="flex items-center pt-10">
        <div className="flex h-20 w-full items-center justify-between rounded-lg bg-slate-900 px-8 text-gray-100 ">
          <p>npm install @formbricks/react</p>
          <button onClick={() => navigator.clipboard.writeText("npm install @formbricks/react")}>
            <DocumentDuplicateIcon className="h-8 w-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
