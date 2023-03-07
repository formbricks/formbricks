// a component which receives a settings title, description and children

export default function SettingsCard({
  title,
  description,
  children,
  soon,
}: {
  title: string;
  description: string;
  children: any;
  soon?: boolean;
}) {
  return (
    <div className="my-4 w-full bg-white shadow sm:rounded-lg">
      <div className="rounded-t-lg border-b border-slate-200 bg-slate-100 px-6 py-5">
        <div className="flex">
          <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
          {soon && (
            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
              coming soon
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className=" px-6 py-5">{children} </div>
    </div>
  );
}
