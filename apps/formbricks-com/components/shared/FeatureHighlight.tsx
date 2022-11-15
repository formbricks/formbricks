import Button from "./Button";
import { useRouter } from "next/router";
import clsx from "clsx";

interface Props {
  featureTitle: string;
  text: string;
  img: React.ReactNode;
  isImgLeft?: boolean;
  cta?: string;
  href?: string;
  disabled?: boolean;
}

export default function FeatureHighlights({
  featureTitle,
  text,
  img,
  isImgLeft,
  cta,
  href,
  disabled,
}: Props) {
  const router = useRouter();

  return (
    <div className="my-12">
      <div className="mx-auto max-w-md px-4 sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:px-8">
        <div className="md:grid-cols-2 lg:grid lg:items-center lg:gap-24">
          <div className={clsx(isImgLeft ? "order-last" : "")}>
            <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-3xl">
              {featureTitle}
            </h2>
            <div className="text-md mt-6 whitespace-pre-line leading-7 text-slate-500 dark:text-slate-400">
              {text}
            </div>
            <div className="mt-6">
              {cta && href && (
                <Button
                  disabled={disabled}
                  variant="minimal"
                  size="sm"
                  className="mb-8"
                  onClick={() => router.push(href)}>
                  {cta}
                </Button>
              )}
            </div>
          </div>
          {img}
        </div>
      </div>
    </div>
  );
}
