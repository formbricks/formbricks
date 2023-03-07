// a component which receives a settings title, description and children

export default function SettingsCard({ title, description, children }) {
  return (
    <div className="my-4 w-full bg-white px-4 py-5 shadow sm:rounded-lg">
      <div className="">
        <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
        <p className="mt-1 mb-8 max-w-2xl text-sm text-gray-500">{description}</p>
      </div>
      <div className="">{children} </div>
    </div>
  );
}
