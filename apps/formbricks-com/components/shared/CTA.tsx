import Button from "@/components/shared/Button";
import { useRouter } from "next/router";
import HeadingCentered from "./HeadingCenetered";

export default function CTA() {
  const router = useRouter();
  return (
    <>
      <div className="px-4 py-16 mx-auto sm:px-6 lg:px-8 lg:pt-24 lg:pb-40">
        <HeadingCentered closer teaser="Get started" heading="Ready for the last form tool you need?" />

        <div className="grid grid-cols-1 mt-12 md:grid-cols-2">
          <div className="rounded-xl bg-gradient-to-br from-teal-500 via-teal-500 to-teal-600 p-24 text-center text-white md:ml-2.5 md:-mr-5 md:rounded-l-xl">
            <h3 className="text-3xl font-bold">Self-hosted</h3>
            <p className="mt-2 mb-4">Run locally e.g. with docker-compose.</p>
            <Button variant="primary" onClick={() => router.push("/docs")} className="mt-3">
              Read docs
            </Button>
          </div>
          <div className="py-24 text-center text-white rounded-xl bg-gradient-to-br from-blue-700 to-blue-800">
            <h3 className="text-3xl font-bold">Cloud</h3>
            <p className="mt-2 mb-4">Use our free managed service.</p>
            <Button variant="primary" onClick={() => router.push("/docs")} className="mt-3">
              Get started
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
