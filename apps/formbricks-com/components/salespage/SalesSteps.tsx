interface SalesStepsProps {
  steps: Array<{ id: string; name: string; description: string }>;
}

export default function SalesSteps({ steps }: SalesStepsProps) {
  return (
    <div className="relative">
      <ul role="list" className="grid grid-cols-1 gap-4 pt-8 sm:grid-cols-2 md:grid-cols-3 lg:gap-10">
        {steps.map((step) => {
          return (
            <li
              key={step.id}
              className="relative col-span-1 flex flex-col rounded-xl border border-slate-200 bg-slate-100 text-center ">
              <div className="absolute -mt-12 w-full">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-200 text-5xl font-bold text-slate-700 shadow ">
                  {step.id}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-10">
                <h3 className="my-4 text-lg font-medium text-slate-800 ">{step.name}</h3>
                <dl className="mt-1 flex flex-grow flex-col justify-between">
                  <dt className="sr-only">Description</dt>
                  <dd className="text-slate-600 ">{step.description}</dd>
                </dl>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
