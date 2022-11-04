import clsx from "clsx";

interface Props {
  features: any[];
}

export default function FeatureHighlights({ features }: Props) {
  return (
    <ul role="list" className="grid grid-cols-1 gap-6 pt-8 sm:grid-cols-2 md:grid-cols-3">
      {features.map((feature: any) => (
        <li
          key={feature.id}
          className={clsx(
            feature.comingSoon ? "dark:to-blue dark:from-blue-900" : "dark:from-black dark:to-blue-900",
            "relative col-span-1 mt-16 flex flex-col rounded-xl bg-gradient-to-b from-blue-200 to-gray-100 text-center drop-shadow-sm dark:from-black dark:to-blue-900"
          )}>
          <div className="absolute -mt-12 w-full">
            <div
              className={clsx(
                feature.comingSoon
                  ? "dark:to-blue bg-gradient-to-br from-blue-200 to-gray-100 dark:from-blue-900 dark:via-blue-900"
                  : "via-blue to-blue dark bg-gradient-to-br from-black ",
                "mx-auto flex h-20 w-20 items-center justify-center rounded-full shadow"
              )}>
              <feature.icon className="mx-auto h-10 w-10 flex-shrink-0 text-teal-500" />
            </div>
          </div>
          <div className="flex flex-1 flex-col p-10">
            <h3 className="text-blue my-4 text-lg font-medium dark:text-blue-100">{feature.name}</h3>
            <dl className="mt-1 flex flex-grow flex-col justify-between">
              <dt className="sr-only">Description</dt>
              <dd className="text-sm text-gray-600 dark:text-blue-400">{feature.description}</dd>
              {feature.comingSoon && (
                <dd className="mt-4">
                  <span className="rounded-full bg-gray-400 px-3 py-1 text-xs font-medium text-blue-50">
                    coming soon
                  </span>
                </dd>
              )}
            </dl>
          </div>
        </li>
      ))}
    </ul>
  );
}
