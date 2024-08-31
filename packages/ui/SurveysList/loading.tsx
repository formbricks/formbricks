const Loading = () => {
  return (
    <>
      <div className="grid w-full grid-cols-8 place-items-center px-6 text-sm text-slate-800">
        <div className="col-span-4 place-self-start">Name</div>
        <div className="col-span-4 grid w-full grid-cols-5 place-items-center">
          <div className="col-span-2">Created at</div>
          <div className="col-span-2">Updated at</div>
        </div>
      </div>
      <div className="flex w-full flex-col gap-3">
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
            className="relative grid w-full grid-cols-8 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all ease-in-out hover:scale-[101%]">
            <div className="col-span-2 flex max-w-full items-center justify-self-start text-sm font-medium text-slate-900">
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200"></div>
            </div>
            <div className="flex w-fit">
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200"></div>
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-16 animate-pulse rounded-full bg-slate-200"></div>
            </div>

            <div className="col-span-4 grid w-full grid-cols-5 place-items-center">
              <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
                <div className="m-2 h-4 w-28 animate-pulse rounded-full bg-slate-200"></div>
              </div>
              <div className="whitespace-wrap col-span-2 my-auto text-center text-sm text-slate-500">
                <div className="m-2 h-4 w-28 animate-pulse rounded-full bg-slate-200"></div>
              </div>
              <div className="place-self-end">
                <div className="m-2 h-4 w-4 animate-pulse rounded-lg bg-slate-200"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default Loading;
