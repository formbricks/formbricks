import Button from "@/components/shared/Button";
import { useRouter } from "next/router";

export default function CTA() {
  const router = useRouter();
  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:pt-24 lg:pb-40">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-base font-semibold uppercase tracking-wider text-teal-600">Get started</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            Ready for the last form tool you need?
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2">
          <div className="rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 py-20 text-center text-white md:ml-2.5 md:-mr-5 md:rounded-l-xl">
            <h3 className="text-3xl font-bold">Self-hosted</h3>
            <p className="mt-2 mb-4">Run locally e.g. with docker-compose.</p>
            <Button variant="secondary" onClick={() => router.push("/docs")} className="mt-3">
              Read docs
            </Button>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 py-20 text-center text-white">
            <h3 className="text-3xl font-bold">Cloud</h3>
            <p className="mt-2 mb-4">Use our free managed service.</p>
            <Button variant="secondary" onClick={() => router.push("/docs")} className="mt-3">
              Read docs
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
