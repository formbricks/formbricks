export default function Loading() {
  return (
    <div className="flex h-[100vh] w-[80vw] animate-pulse flex-col items-center justify-between p-12 text-white">
      <div className="flex w-full justify-between">
        <div className="h-12 w-1/6 rounded-lg bg-slate-200"></div>
        <div className="h-12 w-1/3 rounded-lg bg-slate-200"></div>
        <div className="h-0 w-1/6"></div>
      </div>
      <div className="h-1/3 w-1/2 rounded-lg bg-slate-200"></div>
      <div className="h-10 w-1/2 rounded-lg bg-slate-200"></div>
    </div>
  );
}
