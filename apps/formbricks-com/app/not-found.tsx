import { Button } from "@/components/docs/Button";
import { HeroPattern } from "@/components/docs/HeroPattern";

export default function NotFound() {
  return (
    <>
      <HeroPattern />
      <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Page not found</h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
          Sorry, we couldn’t find the page you’re looking for.
        </p>
        <Button href="/" arrow="right" className="mt-8">
          Back to docs
        </Button>
      </div>
    </>
  );
}
