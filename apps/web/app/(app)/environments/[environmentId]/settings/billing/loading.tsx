export default function Loading() {
  return (
    <div>
      <h2 className="my-4 text-2xl font-medium leading-6 text-slate-800">Billing & Plan</h2>
      <div className="grid grid-cols-2 gap-4 rounded-lg p-8">
        <div className=" h-[75vh] animate-pulse rounded-md bg-gray-200 "></div>
        <div className=" h-96 animate-pulse rounded-md bg-gray-200"></div>
        <div className="col-span-2 h-96 bg-gray-200 p-8"></div>
      </div>
    </div>
  );
}
