import Button from "./Button";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";

export default function HeadingCentered() {
  const router = useRouter();
  return (
    <div className="grid content-center grid-cols-1 gap-10 pt-24 pb-12 mx-auto md:grid-cols-2">
      <div className="">
        <p className="font-semibold text-teal-500 uppercase text-md">What are you waiting for?</p>
        <p className="my-0 text-4xl font-semibold tracking-tight text-blue dark:text-blue-100">
          Try it right now!
        </p>
        <p className="text-blue-500 dark:text-blue-300 ">
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
