import clsx from "clsx";

interface Props {
  features: Array;
}

export default function FeatureHighlights({ features }: Props) {
  return (
    <ul role="list" className="grid grid-cols-1 gap-6 pt-8 sm:grid-cols-2 md:grid-cols-3">
      {features.map((feature) => (
        <li
          key={feature.id}
          className={clsx(
            feature.comingSoon ? "dark:to-blue dark:from-blue-900" : "dark:from-black dark:to-blue-900",
            "relative col-span-1 mt-16 flex flex-col rounded-xl bg-gradient-to-b from-blue-200 to-gray-100 text-center drop-shadow-sm dark:from-black dark:to-blue-900"
          )}>
          <div className="absolute w-full -mt-12">
            <div
              className={clsx(
                feature.comingSoon
                  ? "dark:to-blue bg-gradient-to-br from-blue-200 to-gray-100 dark:from-blue-900 dark:via-blue-900"
                  : "via-blue to-blue dark bg-gradient-to-br from-black ",
                "mx-auto flex h-20 w-20 items-center justify-center rounded-full shadow"
              )}>
              <feature.icon className="flex-shrink-0 w-10 h-10 mx-auto text-teal-500" />
            </div>
          </div>
          <div className="flex flex-col flex-1 p-10">
            <h3 className="my-4 text-lg font-medium text-blue dark:text-blue-100">{feature.name}</h3>
            <dl className="flex flex-col justify-between flex-grow mt-1">
              <dt className="sr-only">Description</dt>
              <dd className="text-sm text-gray-600 dark:text-blue-400">{feature.description}</dd>
              {feature.comingSoon && (
                <dd className="mt-4">
                  <span className="px-3 py-1 text-xs font-medium bg-gray-400 rounded-full text-blue-50">
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
