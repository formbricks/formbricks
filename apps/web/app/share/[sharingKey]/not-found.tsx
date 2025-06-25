import { Button } from "@/modules/ui/components/button";
import { getTranslate } from "@/tolgee/server";
import Link from "next/link";

const NotFound = async () => {
  const t = await getTranslate();
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">404</p>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{t("share.page_not_found")}</h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
        {t("share.page_not_found_description")}
      </p>
      <Link href={"/"}>
        <Button className="mt-8">{t("share.back_to_home")}</Button>
      </Link>
    </div>
  );
};

export default NotFound;
