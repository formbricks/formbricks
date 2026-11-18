import { Metadata } from "next";
import Link from "next/link";
import { getTranslate } from "@/lingodotdev/server";
import { Button } from "@/modules/ui/components/button";

// Also the title when a page or its metadata calls `notFound()`, so the tab doesn't name a section
// that isn't there.
export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslate();
  return { title: t("common.page_not_found") };
};

const NotFound = () => {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white" data-testid="error-code">
        404
      </p>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">Page not found</h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400" data-testid="error-message">
        Sorry, we couldn&apos;t find the page you&apos;re looking for.
      </p>
      <Link href={"/"}>
        <Button className="mt-8">Back to home</Button>
      </Link>
    </div>
  );
};

export default NotFound;
