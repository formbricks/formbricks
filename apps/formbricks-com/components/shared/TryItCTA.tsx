import Button from "../shared/Button";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";

export default function HeadingCentered() {
  const router = useRouter();
  return (
    <div className="grid content-center max-w-md grid-cols-2 gap-10 px-4 pt-24 mx-auto pb-36 sm:max-w-3xl sm:px-6 lg:max-w-6xl lg:px-8">
      <div className="">
        <p className="mb-3 font-semibold text-teal-500 uppercase text-md">What are you waiting for?</p>
        <h2 className="text-3xl font-bold tracking-tight text-blue dark:text-blue-100 sm:text-4xl">
          Try it right now!
        </h2>
        <p className="mt-3 text-xl text-blue-500 dark:text-blue-300 sm:mt-4">
          Dive right in or browse docs for examples.
        </p>
        <p className="mb-3 text-xl text-blue-500 dark:text-blue-300 sm:mb-4">
          Questions? Join our Discord, we’re happy to help!
        </p>
        <Button variant="secondary" onClick={() => router.push("/docs")}>
          Read docs
        </Button>
        <Button variant="primary" className="ml-3" onClick={() => router.push("/get-started")}>
          Get started
        </Button>
      </div>
      <div className="flex items-center">
        <div className="flex items-center justify-between w-full h-20 px-8 text-gray-100 bg-blue-900 rounded-lg ">
          <p>npm install @formbricks/react</p>
          <button onClick={() => navigator.clipboard.writeText("npm install @formbricks/react")}>
            <DocumentDuplicateIcon className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
