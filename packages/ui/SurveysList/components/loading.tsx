const Loading = () => {
  return (
    <>
      <div className="grid grid-cols-5 gap-4">
        {[...Array(5)].map((_, index) => (
          <div
            key={index}
            className="relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all ease-in-out hover:scale-[101%]">
            <div className="mb-10 flex items-center justify-between">
              <div className="h-4 w-16 animate-pulse rounded-full bg-slate-200"></div>
              <div className="h-4 w-4 animate-pulse rounded-lg bg-slate-200"></div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200"></div>
              <div className="h-4 w-20 animate-pulse rounded-full bg-slate-200"></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default Loading;
