import Button from "../shared/Button";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";

export default function HeadingCentered() {
  return (
    <div className="mx-auto grid max-w-md grid-cols-2 content-center gap-10 px-4 pt-24 pb-36 sm:max-w-3xl sm:px-6 lg:max-w-6xl lg:px-8">
      <div className="">
        <p className="text-md mb-3 font-semibold uppercase text-teal-500">What are you waiting for?</p>
        <h2 className="text-blue text-3xl font-bold tracking-tight dark:text-blue-100 sm:text-4xl">
          Try it right now!
        </h2>
        <p className="mt-3 text-xl text-blue-500 dark:text-blue-300 sm:mt-4">
          Dive right in or browse docs for examples.
        </p>
        <p className="mb-3 text-xl text-blue-500 dark:text-blue-300 sm:mb-4">
          Questions? Join our Discord, we’re happy to help!
        </p>
        <Button variant="secondary">See examples</Button>
        <Button variant="primary" className="ml-3">
          Quick start
        </Button>
      </div>
      <div className="flex items-center">
        <div className="flex h-20 w-full items-center justify-between rounded-lg bg-gray-800 px-8 text-gray-100 ">
          <p>npm install @formbricks/react</p>
          <button onClick={() => navigator.clipboard.writeText("npm install @formbricks/react")}>
            <DocumentDuplicateIcon className="h-8 w-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
